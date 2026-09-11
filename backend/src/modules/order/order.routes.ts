// order 模块用户侧路由（薄层：Zod 校验 → service → 统一响应）

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { verifyJWT } from '../../middlewares/auth.middleware.js'
import { orderTypeRepository } from './order.repository.js'
import {
  createOrder,
  getMyOrders,
  getOrderDetail,
  assertActiveOrderType,
} from './order.service.js'
import { notifyAdminNewOrder } from './order.notify.js'
import { successResponse, errorResponse, ERROR_CODES } from '../../framework/response.js'
import { env } from '../../config/env.js'

// ─── DTO ──────────────────────────────────────────────────────

const createOrderSchema = z.object({
  courseName: z.string().min(1).max(200),
  orderTypeId: z.string().min(1),
  grade: z.enum(['FRESHMAN', 'SOPHOMORE', 'JUNIOR']),
  deadline: z.string().datetime(),
  contactWechat: z.string().min(1).max(100),
  source: z.enum(['MINIPROGRAM', 'PC']),
  redeemItemId: z.string().optional(),
  couponId: z.string().optional(),
})

export async function orderRoutes(fastify: FastifyInstance) {
  // 获取需求类型列表（公开）
  fastify.get('/order-types', async (_request, reply) => {
    const types = await orderTypeRepository.findActive()
    return reply.send(successResponse(types))
  })

  // 创建订单（需 JWT 登录）
  fastify.post('/orders', { preHandler: verifyJWT }, async (request, reply) => {
    const parse = createOrderSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, parse.error.errors[0].message))
    }
    const data = parse.data
    const user = request.user as { userId: string }

    if (new Date(data.deadline) <= new Date()) {
      return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '截止日期必须是未来时间'))
    }

    const orderType = await assertActiveOrderType(data.orderTypeId)

    const order = await createOrder({
      ...data,
      deadline: new Date(data.deadline),
      userId: user.userId,
      redeemItemId: data.redeemItemId,
      couponId: data.couponId,
    })

    notifyAdminNewOrder({ ...order, orderType }).catch(() => {})

    return reply.send(successResponse({
      orderId: order.id,
      orderNo: order.orderNo,
      status: order.status,
      quotedPrice: order.quotedPrice ?? null,
      createdAt: order.createdAt,
      adminWechatId: env.ADMIN_WECHAT_ID,
    }))
  })

  // 我的订单列表（需 JWT）
  fastify.get('/orders/my', { preHandler: verifyJWT }, async (request, reply) => {
    const user = request.user as { userId: string }
    const { page = '1', pageSize = '20', status } = request.query as Record<string, string>
    const result = await getMyOrders(user.userId, Number(page), Number(pageSize), status as any)
    return reply.send(successResponse(result))
  })

  // 订单详情（需 JWT）
  fastify.get('/orders/:id', { preHandler: verifyJWT }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user as { userId: string; role?: string }
    const order = await getOrderDetail(id, user.role === 'admin' ? undefined : user.userId)
    if (!order) return reply.code(404).send(errorResponse(ERROR_CODES.ORDER_NOT_FOUND, '订单不存在'))
    const { adminNote: _note, ...orderData } = order
    return reply.send(successResponse(orderData))
  })
}
