// 上传接口的集成测试：用 Fastify 的 inject 走完整请求链路（鉴权 → DTO → multipart → 校验 → 落盘），
// 只把 Prisma 替换成 mock，因此不需要 PostgreSQL。
//
// 重点验证"安全校验确实在 HTTP 链路上生效"：伪装文件被拒、超限被拒、落盘名与用户输入无关。

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import type { FastifyInstance } from 'fastify'

// ── mock Prisma：只提供上传链路会碰到的两个方法 ──────────────
const findProgress = vi.fn()
const createImage = vi.fn()

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    thesisProgress: { findUnique: (...args: unknown[]) => findProgress(...args) },
    thesisProgressImage: { create: (...args: unknown[]) => createImage(...args) },
  },
}))

import { buildApp } from '../../src/app.js'
import { resolveUploadDir } from '../../src/shared/storage/paths.js'

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 0x07),
])
const GIF = Buffer.from('GIF89a' + 'x'.repeat(64), 'latin1')

/** 手工拼一个 multipart 请求体 */
function multipart(filename: string, contentType: string, content: Buffer) {
  const boundary = '----jituoTestBoundary'
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`)
  return {
    payload: Buffer.concat([head, content, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  }
}

let app: FastifyInstance
let adminToken: string
let userToken: string
const writtenUrls: string[] = []

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
  adminToken = app.jwt.sign({ role: 'admin' })
  userToken = app.jwt.sign({ userId: 'u1', role: 'user' })
})

afterAll(async () => {
  for (const url of writtenUrls) {
    await fs.promises.unlink(path.join(resolveUploadDir(), path.basename(url))).catch(() => {})
  }
  await app.close()
})

function upload(token: string, body: ReturnType<typeof multipart>, url = '/api/admin/thesis/progress/1/images') {
  return app.inject({
    method: 'POST',
    url,
    headers: { authorization: `Bearer ${token}`, 'content-type': body.contentType },
    payload: body.payload,
  })
}

describe('POST /api/admin/thesis/progress/:id/images', () => {
  it('未登录返回 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/thesis/progress/1/images',
      headers: { 'content-type': 'multipart/form-data; boundary=x' },
      payload: Buffer.from(''),
    })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ success: false, error: { code: 'UNAUTHORIZED' } })
  })

  it('普通用户返回 403（管理员专属）', async () => {
    const res = await upload(userToken, multipart('a.png', 'image/png', PNG))
    expect(res.statusCode).toBe(403)
    expect(res.json()).toMatchObject({ success: false, error: { code: 'FORBIDDEN' } })
  })

  it('伪装成 png 的 GIF 被拒（400 FILE_TYPE_INVALID），且不落盘、不写库', async () => {
    findProgress.mockResolvedValue({ id: 1 })
    const res = await upload(adminToken, multipart('innocent.png', 'image/png', GIF))

    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ success: false, error: { code: 'FILE_TYPE_INVALID' } })
    expect(createImage).not.toHaveBeenCalled()
  })

  it('超出 5MB 上限被拒（413 FILE_TOO_LARGE）', async () => {
    findProgress.mockResolvedValue({ id: 1 })
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)])
    const res = await upload(adminToken, multipart('big.png', 'image/png', big))

    expect(res.statusCode).toBe(413)
    expect(res.json()).toMatchObject({ success: false, error: { code: 'FILE_TOO_LARGE' } })
    expect(createImage).not.toHaveBeenCalled()
  })

  it('进度不存在返回 404（而不是 500）', async () => {
    findProgress.mockResolvedValue(null)
    const res = await upload(adminToken, multipart('a.png', 'image/png', PNG))

    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } })
    expect(createImage).not.toHaveBeenCalled()
  })

  it('合法 PNG 成功：落盘名由服务端生成、展示名被清理', async () => {
    findProgress.mockResolvedValue({ id: 1 })
    createImage.mockImplementation(async ({ data }: any) => ({ id: 11, url: data.url, filename: data.filename }))

    const res = await upload(
      adminToken,
      multipart('../../我的 截图.png', 'image/png', PNG),
    )

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    writtenUrls.push(body.data.image.url)

    // 访问路径：/uploads/<24位随机名>.png —— 与用户文件名无关
    expect(body.data.image.url).toMatch(/^\/uploads\/[A-Za-z0-9_-]{24}\.png$/)
    expect(body.data.image.url).not.toContain('我的')
    // 展示名已去掉路径
    expect(body.data.image.filename).toBe('我的 截图.png')

    // 磁盘上确实写入了原图内容
    const onDisk = path.join(resolveUploadDir(), path.basename(body.data.image.url))
    expect(await fs.promises.readFile(onDisk)).toEqual(PNG)
    // 且没有写到上传目录之外
    expect(path.dirname(onDisk)).toBe(path.resolve(resolveUploadDir()))
  })
})
