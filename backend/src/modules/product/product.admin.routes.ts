// product 模块管理侧路由：商品、商品订单、优惠码、收款码、站内通知

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { verifyAdmin } from '../../middlewares/auth.middleware.js'
import { prisma } from '../../lib/prisma.js'
import { successResponse, errorResponse, ERROR_CODES } from '../../framework/response.js'
import { createAdminNotification, getAdminNotifications, markNotificationRead, markAllRead } from './notification.service.js'
import { awardPoints } from '../points/points.service.js'
import { Prisma } from '@prisma/client'

export async function adminProductRoutes(fastify: FastifyInstance) {
  // ── 商品管理 ─────────────────────────────────────────────────
  const productSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(2000).optional(),
    imageUrl: z.string().optional(),
    price: z.number().positive(),
    isActive: z.boolean().optional().default(true),
    sortOrder: z.number().int().optional().default(0),
  })

  fastify.get('/admin/products', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const q = request.query as Record<string, string>
    const page = Number(q.page ?? 1)
    const pageSize = Number(q.pageSize ?? 20)
    const [list, total] = await Promise.all([
      prisma.product.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count(),
    ])
    return reply.send(successResponse({ list, total }))
  })

  fastify.post('/admin/products', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const parse = productSchema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, parse.error.errors[0].message))
    const data = parse.data
    const product = await prisma.product.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        imageUrl: data.imageUrl || null,
        price: data.price,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
      },
    })
    return reply.code(201).send(successResponse(product))
  })

  fastify.put('/admin/products/:id', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parse = productSchema.partial().safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, parse.error.errors[0].message))
    const data = parse.data
    try {
      const product = await prisma.product.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl || null }),
          ...(data.price !== undefined && { price: data.price }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        },
      })
      return reply.send(successResponse(product))
    } catch {
      return reply.code(404).send(errorResponse(ERROR_CODES.NOT_FOUND, '商品不存在'))
    }
  })

  fastify.delete('/admin/products/:id', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const orderCount = await prisma.productOrder.count({ where: { productId: id } })
    if (orderCount > 0) {
      return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, `该商品已有 ${orderCount} 个订单，无法删除`))
    }
    try {
      await prisma.product.delete({ where: { id } })
      return reply.send(successResponse({ deleted: true }))
    } catch {
      return reply.code(404).send(errorResponse(ERROR_CODES.NOT_FOUND, '商品不存在'))
    }
  })

  fastify.patch('/admin/products/:id/toggle', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = await prisma.product.findUnique({ where: { id } })
    if (!existing) return reply.code(404).send(errorResponse(ERROR_CODES.NOT_FOUND, '商品不存在'))
    const product = await prisma.product.update({ where: { id }, data: { isActive: !existing.isActive } })
    return reply.send(successResponse({ isActive: product.isActive }))
  })

  // ── 商品订单管理 ─────────────────────────────────────────────
  fastify.get('/admin/product-orders/stats', { preHandler: [verifyAdmin] }, async (_req, reply) => {
    const rows = await prisma.productOrder.groupBy({
      by: ['status'],
      _count: { id: true },
    })
    const stats: Record<string, number> = {}
    rows.forEach(r => { stats[r.status] = r._count.id })
    return reply.send(successResponse(stats))
  })

  fastify.get('/admin/product-orders', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const q = request.query as Record<string, string>
    const page = Number(q.page ?? 1)
    const pageSize = Number(q.pageSize ?? 20)
    const where: Prisma.ProductOrderWhereInput = {}
    if (q.status) where.status = q.status as any
    if (q.keyword) {
      where.OR = [
        { orderNo: { contains: q.keyword, mode: 'insensitive' } },
        { user: { nickname: { contains: q.keyword, mode: 'insensitive' } } },
        { product: { name: { contains: q.keyword, mode: 'insensitive' } } },
      ]
    }
    const [list, total] = await Promise.all([
      prisma.productOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, nickname: true, email: true } },
          product: { select: { id: true, name: true } },
        },
      }),
      prisma.productOrder.count({ where }),
    ])
    return reply.send(successResponse({ list, total }))
  })

  fastify.get('/admin/product-orders/:id', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const order = await prisma.productOrder.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, nickname: true, email: true, wechatId: true } },
        product: true,
        coupon: { select: { code: true, discountType: true, discountValue: true } },
      },
    })
    if (!order) return reply.code(404).send(errorResponse(ERROR_CODES.NOT_FOUND, '订单不存在'))
    return reply.send(successResponse(order))
  })

  fastify.put('/admin/product-orders/:id/complete', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const order = await prisma.productOrder.findUnique({
      where: { id },
      include: { user: { select: { id: true, invitedById: true } } },
    })
    if (!order) return reply.code(404).send(errorResponse(ERROR_CODES.NOT_FOUND, '订单不存在'))
    if (order.status !== 'PAID') {
      return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '只有已支付的订单才能标记完成'))
    }

    const updated = await prisma.productOrder.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })

    const { userId, user } = order
    if (user.invitedById) {
      const completedCount = await prisma.productOrder.count({
        where: { userId, status: 'COMPLETED' },
      })
      if (completedCount === 1) {
        awardPoints(user.invitedById, 'INVITE_FIRST_ORDER', id, `被邀请用户首次完成商品订单`).catch(() => {})
        awardPoints(userId, 'NEW_USER_FIRST_ORDER', id, '首次完成商品订单').catch(() => {})
      }
    }

    return reply.send(successResponse({ status: updated.status }))
  })

  fastify.put('/admin/product-orders/:id/cancel', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parse = z.object({ reason: z.string().optional() }).safeParse(request.body)
    const reason = parse.success ? (parse.data.reason ?? '管理员操作') : '管理员操作'
    const order = await prisma.productOrder.findUnique({ where: { id } })
    if (!order) return reply.code(404).send(errorResponse(ERROR_CODES.NOT_FOUND, '订单不存在'))
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '已完成或已取消的订单无法操作'))
    }
    await prisma.$transaction(async (tx) => {
      await tx.productOrder.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
      })
      if (order.couponId) {
        await tx.promoCoupon.update({
          where: { id: order.couponId },
          data: { usedCount: { decrement: 1 } },
        })
      }
    })
    createAdminNotification({ type: 'ORDER_CANCELLED', summary: `订单 ${order.orderNo} 已被取消`, orderId: id }).catch(() => {})
    return reply.send(successResponse({ status: 'CANCELLED' }))
  })

  // ── 促销优惠码管理 ───────────────────────────────────────────
  const createCouponSchema = z.object({
    code: z.string().min(1).max(50),
    discountType: z.enum(['FIXED', 'PERCENTAGE']),
    discountValue: z.number().positive(),
    validFrom: z.string().datetime(),
    validTo: z.string().datetime(),
    maxUses: z.number().int().min(1).default(1),
  })

  fastify.get('/admin/promo-coupons', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const q = request.query as Record<string, string>
    const page = Number(q.page ?? 1)
    const pageSize = Number(q.pageSize ?? 20)
    const [list, total] = await Promise.all([
      prisma.promoCoupon.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.promoCoupon.count(),
    ])
    return reply.send(successResponse({ list, total }))
  })

  fastify.post('/admin/promo-coupons', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const parse = createCouponSchema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, parse.error.errors[0].message))
    const data = parse.data
    if (new Date(data.validFrom) >= new Date(data.validTo)) {
      return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '结束时间必须晚于开始时间'))
    }
    try {
      const coupon = await prisma.promoCoupon.create({
        data: {
          code: data.code.toUpperCase(),
          discountType: data.discountType,
          discountValue: data.discountValue,
          validFrom: new Date(data.validFrom),
          validTo: new Date(data.validTo),
          maxUses: data.maxUses,
        },
      })
      return reply.code(201).send(successResponse(coupon))
    } catch (err: any) {
      if (err.code === 'P2002') return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '优惠码已存在'))
      throw err
    }
  })

  fastify.delete('/admin/promo-coupons/:id', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const coupon = await prisma.promoCoupon.findUnique({ where: { id } })
    if (!coupon) return reply.code(404).send(errorResponse(ERROR_CODES.NOT_FOUND, '优惠码不存在'))
    if (coupon.usedCount > 0) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '该优惠码已被使用，无法删除'))
    await prisma.promoCoupon.delete({ where: { id } })
    return reply.send(successResponse({ deleted: true }))
  })

  fastify.patch('/admin/promo-coupons/:id/deactivate', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const coupon = await prisma.promoCoupon.update({ where: { id }, data: { isActive: false } })
      return reply.send(successResponse({ isActive: coupon.isActive }))
    } catch {
      return reply.code(404).send(errorResponse(ERROR_CODES.NOT_FOUND, '优惠码不存在'))
    }
  })

  fastify.patch('/admin/promo-coupons/:id/activate', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const coupon = await prisma.promoCoupon.update({ where: { id }, data: { isActive: true } })
      return reply.send(successResponse({ isActive: coupon.isActive }))
    } catch {
      return reply.code(404).send(errorResponse(ERROR_CODES.NOT_FOUND, '优惠码不存在'))
    }
  })

  // ── 收款码配置 ───────────────────────────────────────────────
  const updatePaymentSchema = z.object({
    wechatUrl: z.string().optional(),
    alipayUrl: z.string().optional(),
  })

  fastify.get('/admin/payment-config', { preHandler: verifyAdmin }, async (_req, reply) => {
    const config = await prisma.paymentConfig.findUnique({ where: { id: 'singleton' } })
    return reply.send(successResponse(config ?? { wechatUrl: null, alipayUrl: null }))
  })

  fastify.put('/admin/payment-config', { preHandler: verifyAdmin }, async (request, reply) => {
    const parse = updatePaymentSchema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, parse.error.errors[0].message))
    const config = await prisma.paymentConfig.upsert({
      where: { id: 'singleton' },
      update: parse.data,
      create: { id: 'singleton', ...parse.data },
    })
    return reply.send(successResponse(config))
  })

  // ── 站内通知 ─────────────────────────────────────────────────
  fastify.put('/admin/notifications/read-all', { preHandler: verifyAdmin }, async (_req, reply) => {
    const updated = await markAllRead()
    return reply.send(successResponse({ updated }))
  })

  fastify.get('/admin/notifications', { preHandler: verifyAdmin }, async (request, reply) => {
    const q = request.query as Record<string, string>
    const unreadOnly = q.unread === 'true'
    const limit = Math.min(Number(q.limit ?? 20), 50)
    const result = await getAdminNotifications(unreadOnly, limit)
    return reply.send(successResponse(result))
  })

  fastify.put('/admin/notifications/:id/read', { preHandler: verifyAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await markNotificationRead(id)
      return reply.send(successResponse({ isRead: true }))
    } catch {
      return reply.code(404).send(errorResponse(ERROR_CODES.NOT_FOUND, '通知不存在'))
    }
  })
}
