// points 模块管理侧路由（薄层）

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { verifyAdmin } from '../../middlewares/auth.middleware.js'
import { successResponse, errorResponse, ERROR_CODES } from '../../framework/response.js'
import { isHttpError } from '../../framework/errors.js'
import { adjustPoints, deductFrozen, unfreeze } from './points.service.js'
import { PointEventType } from '@prisma/client'
import crypto from 'node:crypto'

// 生成8位唯一优惠码
async function generateCouponCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = 'JT' + crypto.randomBytes(3).toString('hex').toUpperCase()
    const exists = await prisma.coupon.findUnique({ where: { code } })
    if (!exists) return code
  }
  throw new Error('Failed to generate coupon code')
}

export async function adminPointsRoutes(fastify: FastifyInstance) {
  // ── 积分规则 ────────────────────────────────────────────────────
  fastify.get('/admin/points/rules', { preHandler: verifyAdmin }, async (_req, reply) => {
    const rules = await prisma.pointRule.findMany({ orderBy: { eventType: 'asc' } })
    return reply.send(successResponse({ rules }))
  })

  fastify.put('/admin/points/rules/:eventType', { preHandler: verifyAdmin }, async (request, reply) => {
    const { eventType } = request.params as { eventType: string }
    const schema = z.object({
      points: z.number().int().positive(),
      enabled: z.boolean(),
      remark: z.string().optional(),
    })
    const parse = schema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '参数错误'))

    if (!Object.values(PointEventType).includes(eventType as PointEventType)) {
      return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '无效的事件类型'))
    }

    await prisma.pointRule.upsert({
      where: { eventType: eventType as PointEventType },
      create: { eventType: eventType as PointEventType, ...parse.data },
      update: parse.data,
    })
    return reply.send(successResponse({ ok: true }))
  })

  // ── 用户积分汇总 ────────────────────────────────────────────────
  fastify.get('/admin/points/users', { preHandler: verifyAdmin }, async (request, reply) => {
    const q = request.query as Record<string, string>
    const page = Math.max(1, Number(q.page) || 1)
    const pageSize = Math.min(50, Math.max(1, Number(q.pageSize) || 20))
    const keyword = q.keyword?.trim()

    const userWhere = keyword
      ? { OR: [{ nickname: { contains: keyword } }, { username: { contains: keyword } }] }
      : {}

    const [total, users] = await Promise.all([
      prisma.user.count({ where: userWhere }),
      prisma.user.findMany({
        where: userWhere,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, nickname: true, username: true,
          pointBalance: { select: { totalPoints: true, frozenPoints: true, lifetimeEarned: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return reply.send(successResponse({
      total,
      list: users.map(u => ({
        userId: u.id,
        nickname: u.nickname,
        username: u.username,
        totalPoints: u.pointBalance?.totalPoints ?? 0,
        frozenPoints: u.pointBalance?.frozenPoints ?? 0,
        lifetimeEarned: u.pointBalance?.lifetimeEarned ?? 0,
      })),
    }))
  })

  // ── 手动调整积分 ────────────────────────────────────────────────
  fastify.post('/admin/points/adjust', { preHandler: verifyAdmin }, async (request, reply) => {
    const schema = z.object({
      userId: z.string().min(1),
      delta: z.number().int().refine(n => n !== 0, '调整量不能为0'),
      remark: z.string().min(1).optional(),
    })
    const parse = schema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, parse.error.errors[0]?.message ?? '参数错误'))

    try {
      const newBalance = await adjustPoints(parse.data.userId, parse.data.delta, parse.data.remark)
      return reply.send(successResponse({ newBalance }))
    } catch (err) {
      if (isHttpError(err) && err.code === ERROR_CODES.INSUFFICIENT_POINTS) {
        return reply.code(400).send(errorResponse(ERROR_CODES.INSUFFICIENT_POINTS, '积分不足，调整后余额不能为负'))
      }
      throw err
    }
  })

  // ── 商城商品管理 ────────────────────────────────────────────────
  fastify.get('/admin/shop/items', { preHandler: verifyAdmin }, async (request, reply) => {
    const q = request.query as Record<string, string>
    const page = Math.max(1, Number(q.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 50))

    const [total, list] = await Promise.all([
      prisma.shopItem.count(),
      prisma.shopItem.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
    return reply.send(successResponse({ total, list }))
  })

  const shopItemSchema = z.object({
    name: z.string().min(1).max(50),
    description: z.string().optional(),
    coverUrl: z.string().url().optional().or(z.literal('')),
    type: z.enum(['SERVICE', 'COUPON']),
    pointsCost: z.number().int().positive(),
    stock: z.number().int().min(-1).default(-1),
    discountAmt: z.number().positive().optional().nullable(),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
  })

  fastify.post('/admin/shop/items', { preHandler: verifyAdmin }, async (request, reply) => {
    const parse = shopItemSchema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, parse.error.errors[0]?.message ?? '参数错误'))
    const item = await prisma.shopItem.create({ data: parse.data as any })
    return reply.code(201).send(successResponse(item))
  })

  fastify.put('/admin/shop/items/:id', { preHandler: verifyAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parse = shopItemSchema.partial().safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '参数错误'))
    const item = await prisma.shopItem.update({ where: { id }, data: parse.data as any })
    return reply.send(successResponse(item))
  })

  fastify.delete('/admin/shop/items/:id', { preHandler: verifyAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const pending = await prisma.redeemOrder.count({ where: { shopItemId: id, status: 'PENDING' } })
    if (pending > 0) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '该商品有待审核的兑换订单，无法删除'))
    await prisma.shopItem.delete({ where: { id } })
    return reply.send(successResponse({ ok: true }))
  })

  // ── 兑换订单管理 ────────────────────────────────────────────────
  fastify.get('/admin/redeem/orders', { preHandler: verifyAdmin }, async (request, reply) => {
    const q = request.query as Record<string, string>
    const page = Math.max(1, Number(q.page) || 1)
    const pageSize = Math.min(50, Math.max(1, Number(q.pageSize) || 20))
    const where = q.status ? { status: q.status as any } : {}

    const [total, list] = await Promise.all([
      prisma.redeemOrder.count({ where }),
      prisma.redeemOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { nickname: true, username: true } },
          shopItem: { select: { name: true, type: true } },
          coupon: { select: { code: true } },
        },
      }),
    ])

    return reply.send(successResponse({ total, list }))
  })

  const approveSchema = z.object({ note: z.string().max(500).optional() })

  fastify.post('/admin/redeem/orders/:id/approve', { preHandler: verifyAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parse = approveSchema.safeParse(request.body ?? {})
    const note = parse.success ? parse.data.note : undefined

    const order = await prisma.redeemOrder.findUnique({
      where: { id },
      include: { shopItem: true },
    })
    if (!order) return reply.code(404).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '订单不存在'))
    if (order.status !== 'PENDING') return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '订单状态不是待审核'))

    await prisma.redeemOrder.update({
      where: { id },
      data: { status: 'COMPLETED', adminNote: note ?? null },
    })

    await deductFrozen(order.userId, order.pointsCost, id)

    if (order.shopItem?.type === 'COUPON' && order.shopItem.discountAmt) {
      const code = await generateCouponCode()
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      await prisma.coupon.create({
        data: {
          code,
          userId: order.userId,
          redeemOrderId: id,
          discountAmt: order.shopItem.discountAmt,
          expiresAt,
        },
      })
    }

    return reply.send(successResponse({ ok: true }))
  })

  fastify.post('/admin/redeem/orders/:id/reject', { preHandler: verifyAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const schema = z.object({ note: z.string().min(1, '请填写拒绝原因') })
    const parse = schema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, parse.error.errors[0]?.message ?? '参数错误'))

    const order = await prisma.redeemOrder.findUnique({ where: { id } })
    if (!order) return reply.code(404).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '订单不存在'))
    if (order.status !== 'PENDING') return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '订单状态不是待审核'))

    await prisma.redeemOrder.update({
      where: { id },
      data: { status: 'REJECTED', adminNote: parse.data.note },
    })

    if (order.shopItemId) {
      const item = await prisma.shopItem.findUnique({ where: { id: order.shopItemId }, select: { stock: true } })
      if (item && item.stock >= 0) {
        await prisma.shopItem.update({
          where: { id: order.shopItemId },
          data: { stock: { increment: 1 } },
        }).catch(() => {})
      }
    }

    await unfreeze(order.userId, order.pointsCost, id)

    return reply.send(successResponse({ ok: true }))
  })
}
