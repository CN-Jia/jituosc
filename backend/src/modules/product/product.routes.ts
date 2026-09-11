// product 模块用户侧路由：商品、商品订单、优惠码

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { verifyJWT } from '../../middlewares/auth.middleware.js'
import { prisma } from '../../lib/prisma.js'
import { successResponse, errorResponse, ERROR_CODES } from '../../framework/response.js'
import {
  createProductOrder,
  getMyProductOrders,
  getProductOrderDetail,
  assertCanTransition,
  validatePromoCoupon,
} from './product.service.js'
import { createAdminNotification } from './notification.service.js'

export async function productRoutes(fastify: FastifyInstance) {
  // 商品列表（需登录）
  fastify.get('/products', { preHandler: verifyJWT }, async (_req, reply) => {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, description: true, imageUrl: true, price: true },
    })
    return reply.send(successResponse(products))
  })

  // 商品详情（需登录）
  fastify.get('/products/:id', { preHandler: verifyJWT }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const product = await prisma.product.findFirst({
      where: { id, isActive: true },
      select: { id: true, name: true, description: true, imageUrl: true, price: true },
    })
    if (!product) return reply.code(404).send(errorResponse(ERROR_CODES.NOT_FOUND, '商品不存在'))
    return reply.send(successResponse(product))
  })

  // 获取收款码配置（需登录）
  fastify.get('/payment-config', { preHandler: verifyJWT }, async (_req, reply) => {
    const config = await prisma.paymentConfig.findUnique({ where: { id: 'singleton' } })
    return reply.send(successResponse({ wechatUrl: config?.wechatUrl ?? null, alipayUrl: config?.alipayUrl ?? null }))
  })

  // 创建商品订单
  const createSchema = z.object({
    productId: z.string().min(1),
    couponCode: z.string().optional(),
    userNote: z.string().max(500).optional(),
  })

  fastify.post('/product-orders', { preHandler: verifyJWT }, async (request, reply) => {
    const parse = createSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, parse.error.errors[0].message))
    }
    const user = request.user as { userId: string }
    const order = await createProductOrder({ userId: user.userId, ...parse.data })
    fastify.log.info({ event: 'product_order_created', orderId: order.id, userId: user.userId })
    return reply.code(201).send(successResponse({
      orderId: order.id,
      orderNo: order.orderNo,
      originalPrice: order.originalPrice,
      discountAmount: order.discountAmount,
      paidPrice: order.paidPrice,
      status: order.status,
    }))
  })

  // 我的商品订单列表
  fastify.get('/product-orders/my', { preHandler: verifyJWT }, async (request, reply) => {
    const user = request.user as { userId: string }
    const q = request.query as Record<string, string>
    const result = await getMyProductOrders(
      user.userId,
      Number(q.page ?? 1),
      Number(q.pageSize ?? 20),
      q.status as any,
    )
    return reply.send(successResponse(result))
  })

  // 商品订单详情
  fastify.get('/product-orders/:id', { preHandler: verifyJWT }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user as { userId: string }
    const order = await getProductOrderDetail(id, user.userId)
    if (!order) return reply.code(404).send(errorResponse(ERROR_CODES.NOT_FOUND, '订单不存在'))
    return reply.send(successResponse(order))
  })

  // 用户标记已支付
  fastify.post('/product-orders/:id/pay', { preHandler: verifyJWT }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user as { userId: string }
    const order = await prisma.productOrder.findFirst({ where: { id, userId: user.userId }, include: { product: { select: { name: true } } } })
    if (!order) return reply.code(404).send(errorResponse(ERROR_CODES.NOT_FOUND, '订单不存在'))
    try {
      assertCanTransition(order.status, 'PAID', false)
    } catch {
      return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '当前订单状态不可标记已支付'))
    }
    const updated = await prisma.productOrder.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
    })
    const user2 = await prisma.user.findUnique({ where: { id: user.userId }, select: { nickname: true } })
    const summary = `用户 ${user2?.nickname ?? '—'} 已支付订单 ${order.orderNo}（¥${order.paidPrice} · ${order.product.name}）`
    createAdminNotification({ type: 'ORDER_PAID', summary, orderId: id }).catch(() => {})
    fastify.log.info({ event: 'product_order_paid', orderId: id, userId: user.userId })
    return reply.send(successResponse({ status: updated.status, paidAt: updated.paidAt }))
  })

  // 用户取消订单（仅 CREATED 状态）
  fastify.post('/product-orders/:id/cancel', { preHandler: verifyJWT }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user as { userId: string }
    const order = await prisma.productOrder.findFirst({ where: { id, userId: user.userId } })
    if (!order) return reply.code(404).send(errorResponse(ERROR_CODES.NOT_FOUND, '订单不存在'))
    if (order.status !== 'CREATED') {
      return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '只能取消"已创建"状态的订单'))
    }
    await prisma.$transaction(async (tx) => {
      await tx.productOrder.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: '用户主动取消' },
      })
      if (order.couponId) {
        await tx.promoCoupon.update({
          where: { id: order.couponId },
          data: { usedCount: { decrement: 1 } },
        })
      }
    })
    fastify.log.info({ event: 'product_order_cancelled', orderId: id, userId: user.userId })
    return reply.send(successResponse({ status: 'CANCELLED' }))
  })

  // 校验优惠码并预览折扣
  const validateSchema = z.object({
    code: z.string().min(1),
    productId: z.string().min(1),
  })

  fastify.post('/promo-coupons/validate', { preHandler: verifyJWT }, async (request, reply) => {
    const parse = validateSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, parse.error.errors[0].message))
    }
    const { code, productId } = parse.data
    const result = await validatePromoCoupon(code, productId)
    return reply.send(successResponse(result))
  })
}
