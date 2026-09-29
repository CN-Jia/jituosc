// 接口健壮性集成测试：把线上实测出的 4 个问题钉成回归用例。
//
// 线上实测背景（2026-09-30）：
//  1. GET /api/posts?page=0&limit=9999 → 500（skip 算成 -1，直接把 Prisma 打崩）
//  2. POST /api/orders 传坏 JSON → 500（应 400）
//  3. 评论未审核的帖子 → 404「帖子不存在」（帖子其实存在，只是在审核队列）
//  4. PUT /api/auth/profile 传空字符串（前端「年级=不设置」就是这样）→ 400「参数错误」
//
// Prisma 全部 mock，因此不需要 PostgreSQL。

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

const postFindMany = vi.fn()
const postCount = vi.fn()
const postFindUnique = vi.fn()
const commentCreate = vi.fn()
const userFindUnique = vi.fn()
const userUpdate = vi.fn()

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    post: {
      findMany: (...a: unknown[]) => postFindMany(...a),
      count: (...a: unknown[]) => postCount(...a),
      findUnique: (...a: unknown[]) => postFindUnique(...a),
    },
    comment: { create: (...a: unknown[]) => commentCreate(...a) },
    user: {
      findUnique: (...a: unknown[]) => userFindUnique(...a),
      update: (...a: unknown[]) => userUpdate(...a),
    },
  },
}))

import { buildApp } from '../../src/app.js'

let app: FastifyInstance
let token: string

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
  token = app.jwt.sign({ userId: 'user-1', role: 'user' })
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  postFindMany.mockReset().mockResolvedValue([])
  postCount.mockReset().mockResolvedValue(0)
  postFindUnique.mockReset()
  commentCreate.mockReset().mockResolvedValue({ id: 'c1', content: 'x' })
  userFindUnique.mockReset().mockResolvedValue({ id: 'user-1', emailVerified: true })
  userUpdate.mockReset()
})

const authHeaders = () => ({ authorization: `Bearer ${token}` })

describe('GET /api/posts 分页参数校验', () => {
  it('page=0 返回 400 而不是 500，且不去查库', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/posts?page=0' })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } })
    expect(postFindMany).not.toHaveBeenCalled()
  })

  it('pageSize 超上限返回 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/posts?page=1&pageSize=9999' })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.message).toContain('pageSize')
  })

  it('page 不是数字返回 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/posts?page=abc' })
    expect(res.statusCode).toBe(400)
  })

  it('board 取值非法返回 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/posts?board=__evil__' })
    expect(res.statusCode).toBe(400)
  })

  it('合法分页正常返回，并把 page/pageSize 归一化成数字', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/posts?page=2&pageSize=5' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ success: true, data: { page: 2, pageSize: 5 } })
    expect(postFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 5, take: 5 }))
  })

  it('不传参数时使用安全默认值（page=1 / pageSize=10）', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/posts' })
    expect(res.statusCode).toBe(200)
    expect(postFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 10 }))
  })
})

describe('请求体解析失败', () => {
  it('坏 JSON → 400 VALIDATION_ERROR（不是 500，也不泄露 FST_ERR 内部码）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      payload: '{bad json',
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toBe('请求体不是合法的 JSON')
    expect(res.body).not.toContain('FST_ERR')
  })
})

describe('未知路由的响应结构', () => {
  it('与其它接口统一（success:false + error.code/message）', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/__nope__' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } })
    expect(res.json()).not.toHaveProperty('statusCode')
  })
})

describe('评论接口的语义', () => {
  it('帖子不存在 → 404', async () => {
    postFindUnique.mockResolvedValue(null)
    const res = await app.inject({
      method: 'POST',
      url: '/api/posts/__nope__/comments',
      headers: authHeaders(),
      payload: { content: '你好' },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.message).toBe('帖子不存在')
  })

  it('帖子存在但未过审 → 403 并说明原因，而不是谎称不存在', async () => {
    postFindUnique.mockResolvedValue({ status: 'PENDING' })
    const res = await app.inject({
      method: 'POST',
      url: '/api/posts/p1/comments',
      headers: authHeaders(),
      payload: { content: '你好' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.message).toContain('审核')
    expect(commentCreate).not.toHaveBeenCalled()
  })

  it('已过审的帖子可以评论', async () => {
    postFindUnique.mockResolvedValue({ status: 'APPROVED' })
    const res = await app.inject({
      method: 'POST',
      url: '/api/posts/p1/comments',
      headers: authHeaders(),
      payload: { content: '你好' },
    })
    expect(res.statusCode).toBe(201)
    expect(commentCreate).toHaveBeenCalled()
  })
})

describe('PUT /api/auth/profile 空字符串与字段级提示', () => {
  it('grade/phone 传空字符串 → 当作「未设置」，落库为 null', async () => {
    userUpdate.mockResolvedValue({ nickname: '小明', phone: null, wechatId: null, grade: null })
    const res = await app.inject({
      method: 'PUT',
      url: '/api/auth/profile',
      headers: authHeaders(),
      payload: { nickname: '小明', phone: '', grade: '', wechatId: '' },
    })
    expect(res.statusCode).toBe(200)
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: null, grade: null, wechatId: null }) }),
    )
  })

  it('非法手机号 → 400 且提示到具体字段', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/auth/profile',
      headers: authHeaders(),
      payload: { phone: '12345' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.message).toBe('手机号格式不正确')
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it('昵称超长 → 400 且提示到具体字段（不再是笼统的「参数错误」）', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/auth/profile',
      headers: authHeaders(),
      payload: { nickname: '一二三四五六七八九十一二三四五六七八九十一' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.message).toBe('昵称最多 20 个字')
  })

  it('非法年级 → 400', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/auth/profile',
      headers: authHeaders(),
      payload: { grade: 'SENIOR' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.message).toBe('年级取值不合法')
  })

  it('只有合法字段时正常更新', async () => {
    userUpdate.mockResolvedValue({ nickname: '小明', phone: '13900000000', wechatId: 'wx', grade: 'JUNIOR' })
    const res = await app.inject({
      method: 'PUT',
      url: '/api/auth/profile',
      headers: authHeaders(),
      payload: { nickname: '小明', phone: '13900000000', grade: 'JUNIOR' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ nickname: '小明', grade: 'JUNIOR' })
  })
})
