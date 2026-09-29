// 图片上传安全校验的单元测试：
// 重点是"只信文件内容"——改名的伪装文件必须被拒，且落盘名与用户输入无关。

import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import type { MultipartFile } from '@fastify/multipart'

import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  extensionFor,
  readValidatedImage,
  sanitizeDisplayName,
  saveImageUpload,
  sniffImageType,
} from '../../src/shared/storage/image-upload.js'
import { resolveUploadDir } from '../../src/shared/storage/paths.js'
import { HttpError } from '../../src/framework/errors.js'

// ─── 造样本 ──────────────────────────────────────────────────

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(24, 0x01),
])
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(24, 0x02)])
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'latin1'),
  Buffer.from([0x20, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'latin1'),
  Buffer.alloc(16, 0x03),
])

const GIF = Buffer.from('GIF89a' + '\u0001'.repeat(20), 'latin1')
const PDF = Buffer.from('%PDF-1.7\n%âãÏÓ', 'latin1')
const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(20)])
const TEXT = Buffer.from('just a plain text file, not an image')

/** 构造一个最小的假 MultipartFile（只用到 toBuffer / filename / file.truncated） */
function fakeFile(
  buffer: Buffer,
  opts: { filename?: string; truncated?: boolean } = {},
): MultipartFile {
  return {
    filename: opts.filename ?? 'screenshot.png',
    toBuffer: async () => {
      if (opts.truncated) {
        const err = Object.assign(new Error('request file too large'), {
          code: 'FST_REQ_FILE_TOO_LARGE',
          statusCode: 413,
        })
        throw err
      }
      return buffer
    },
    file: { truncated: Boolean(opts.truncated) },
  } as unknown as MultipartFile
}

const writtenFiles: string[] = []

afterEach(async () => {
  for (const url of writtenFiles.splice(0)) {
    await fs.promises.unlink(path.join(resolveUploadDir(), path.basename(url))).catch(() => {})
  }
})

// ─── 魔数嗅探 ────────────────────────────────────────────────

describe('sniffImageType：只按文件内容判断类型', () => {
  it('识别 PNG / JPEG / WEBP', () => {
    expect(sniffImageType(PNG)).toBe('image/png')
    expect(sniffImageType(JPEG)).toBe('image/jpeg')
    expect(sniffImageType(WEBP)).toBe('image/webp')
  })

  it('拒绝非白名单格式（GIF / PDF / ZIP / 纯文本 / 空文件）', () => {
    expect(sniffImageType(GIF)).toBeNull()
    expect(sniffImageType(PDF)).toBeNull()
    expect(sniffImageType(ZIP)).toBeNull()
    expect(sniffImageType(TEXT)).toBeNull()
    expect(sniffImageType(Buffer.alloc(0))).toBeNull()
  })

  it('拒绝只有半截魔数的文件', () => {
    expect(sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull()
    expect(sniffImageType(Buffer.from([0xff, 0xd8]))).toBeNull()
    // RIFF 头但第二段不是 WEBP（例如 WAV）
    expect(
      sniffImageType(
        Buffer.concat([
          Buffer.from('RIFF', 'latin1'),
          Buffer.from([0x20, 0x00, 0x00, 0x00]),
          Buffer.from('WAVE', 'latin1'),
        ]),
      ),
    ).toBeNull()
  })

  it('白名单只包含 3 种格式', () => {
    expect(ALLOWED_IMAGE_TYPES).toEqual(['image/png', 'image/jpeg', 'image/webp'])
  })
})

describe('extensionFor：扩展名由魔数推导，不取自用户文件名', () => {
  it('返回对应扩展名', () => {
    expect(extensionFor('image/png')).toBe('.png')
    expect(extensionFor('image/jpeg')).toBe('.jpg')
    expect(extensionFor('image/webp')).toBe('.webp')
  })
})

describe('sanitizeDisplayName：展示用文件名清理（跨平台确定性）', () => {
  it('剥离 POSIX 与 Windows 路径，防目录穿越', () => {
    expect(sanitizeDisplayName('../../etc/passwd')).toBe('passwd')
    expect(sanitizeDisplayName('C:\\Users\\x\\shot.png')).toBe('shot.png')
    expect(sanitizeDisplayName('/var/www/..//a/b.png')).toBe('b.png')
  })

  it('去掉控制字符并截断长度', () => {
    expect(sanitizeDisplayName('a\u0000b\u001f.png')).toBe('ab.png')
    expect(sanitizeDisplayName('x'.repeat(500)).length).toBe(80)
  })

  it('空值回落为「截图」', () => {
    expect(sanitizeDisplayName('')).toBe('截图')
    expect(sanitizeDisplayName('   ')).toBe('截图')
    expect(sanitizeDisplayName(undefined)).toBe('截图')
    expect(sanitizeDisplayName('.')).toBe('截图')
  })
})

// ─── 读取 + 校验 ─────────────────────────────────────────────

describe('readValidatedImage：类型与大小校验', () => {
  it('合法 PNG 通过并返回类型与大小', async () => {
    const result = await readValidatedImage(fakeFile(PNG))
    expect(result.type).toBe('image/png')
    expect(result.size).toBe(PNG.length)
  })

  it('伪装文件被拒：GIF 内容改名为 .png（关键攻击面）', async () => {
    const file = fakeFile(GIF, { filename: 'innocent.png' })
    await expect(readValidatedImage(file)).rejects.toMatchObject({
      code: 'FILE_TYPE_INVALID',
      statusCode: 400,
    })
  })

  it('伪装文件被拒：文件名是 .png 但内容是 PDF / ZIP', async () => {
    await expect(readValidatedImage(fakeFile(PDF, { filename: 'a.png' }))).rejects.toThrow(HttpError)
    await expect(readValidatedImage(fakeFile(ZIP, { filename: 'a.png' }))).rejects.toThrow(HttpError)
  })

  it('超出大小上限抛 413 FILE_TOO_LARGE', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_BYTES)])
    await expect(readValidatedImage(fakeFile(big))).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
      statusCode: 413,
    })
  })

  it('multipart 截断（超限被杀）同样抛 413', async () => {
    await expect(
      readValidatedImage(fakeFile(PNG, { truncated: true })),
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE', statusCode: 413 })
  })

  it('空文件抛 400', async () => {
    await expect(readValidatedImage(fakeFile(Buffer.alloc(0)))).rejects.toMatchObject({
      code: 'FILE_TYPE_INVALID',
      statusCode: 400,
    })
  })

  it('自定义上限生效', async () => {
    await expect(readValidatedImage(fakeFile(PNG), 8)).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
    })
  })
})

// ─── 落盘 ────────────────────────────────────────────────────

describe('saveImageUpload：落盘名由服务端生成', () => {
  it('路径与用户文件名无关，扩展名来自魔数', async () => {
    const saved = await saveImageUpload(
      fakeFile(JPEG, { filename: '../../evil.php.png' }),
    )
    writtenFiles.push(saved.url)

    expect(saved.url.startsWith('/uploads/')).toBe(true)
    expect(saved.url.endsWith('.jpg')).toBe(true)      // 魔数是 JPEG，与文件名 .png 无关
    expect(saved.url).not.toContain('evil')
    expect(saved.displayName).toBe('evil.php.png')      // 展示名只作展示
    expect(saved.type).toBe('image/jpeg')

    const onDisk = path.basename(saved.url)
    expect(await fs.promises.readFile(path.join(resolveUploadDir(), onDisk))).toEqual(JPEG)
  })

  it('文件名里带路径分隔符也无法写出上传目录', async () => {
    const saved = await saveImageUpload(fakeFile(PNG, { filename: '../../../root/.ssh/x.png' }))
    writtenFiles.push(saved.url)
    const stored = path.join(resolveUploadDir(), path.basename(saved.url))
    expect(path.dirname(stored)).toBe(path.resolve(resolveUploadDir()))
  })
})
