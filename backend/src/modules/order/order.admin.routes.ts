// order 模块管理侧路由（薄层）

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { verifyAdmin } from '../../middlewares/auth.middleware.js'
import { orderTypeRepository } from './order.repository.js'
import {
  adminListOrders,
  adminGetOrderDetail,
  updateOrderStatusWithSideEffects,
  addAdminNote,
  getStats,
  setQuotedPrice,
} from './order.service.js'
import { successResponse, errorResponse, ERROR_CODES } from '../../framework/response.js'
import { OrderStatus } from '@prisma/client'

export async function adminOrderRoutes(fastify: FastifyInstance) {
  // 统计数据
  fastify.get('/admin/stats', { preHandler: verifyAdmin }, async (_request, reply) => {
    const stats = await getStats()
    return reply.send(successResponse(stats))
  })

  // 订单列表
  fastify.get('/admin/orders', { preHandler: verifyAdmin }, async (request, reply) => {
    const q = request.query as Record<string, string>
    const result = await adminListOrders({
      status: q.status as OrderStatus | undefined,
      keyword: q.keyword,
      page: q.page ? Number(q.page) : 1,
      pageSize: q.pageSize ? Number(q.pageSize) : 20,
    })
    return reply.send(successResponse(result))
  })

  // 订单详情
  fastify.get('/admin/orders/:id', { preHandler: verifyAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const order = await adminGetOrderDetail(id)
    if (!order) return reply.code(404).send(errorResponse(ERROR_CODES.ORDER_NOT_FOUND, '订单不存在'))
    return reply.send(successResponse(order))
  })

  // 更新状态（含通知与积分联动）
  const updateStatusSchema = z.object({
    status: z.enum(['CREATED', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
    remark: z.string().max(500).optional(),
    estimatedDelivery: z.string().datetime().optional(),
    rewardPoints: z.number().int().min(0).optional(),
  })

  fastify.patch('/admin/orders/:id/status', { preHandler: verifyAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parse = updateStatusSchema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '参数错误'))
    const { status, remark, estimatedDelivery, rewardPoints } = parse.data

    try {
      const result = await updateOrderStatusWithSideEffects(id, status, { remark, estimatedDelivery, rewardPoints })
      return reply.send(successResponse(result))
    } catch (err) {
      if ((err as { code?: string }).code === ERROR_CODES.INVALID_STATUS_TRANSITION) {
        return reply.code(422).send(errorResponse(
          ERROR_CODES.INVALID_STATUS_TRANSITION,
          (err as Error).message,
        ))
      }
      throw err
    }
  })

  // 添加内部备注
  const noteSchema = z.object({ note: z.string().min(1).max(1000) })

  fastify.post('/admin/orders/:id/note', { preHandler: verifyAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parse = noteSchema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '备注不能为空'))
    const order = await addAdminNote(id, parse.data.note.trim())
    return reply.send(successResponse({ adminNote: order.adminNote }))
  })

  // 设置报价
  const quoteSchema = z.object({ price: z.string().min(1).max(100) })

  fastify.post('/admin/orders/:id/quote', { preHandler: verifyAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parse = quoteSchema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '报价不能为空'))
    const order = await setQuotedPrice(id, parse.data.price.trim())
    return reply.send(successResponse({ quotedPrice: order.quotedPrice }))
  })

  // ── 需求类型管理 ─────────────────────────────────────────────
  const typeSchema = z.object({
    name: z.string().min(1).max(50),
    description: z.string().max(200).optional(),
    price: z.string().min(1).max(100),
    sortOrder: z.number().int().default(0),
    isActive: z.boolean().default(true),
  })

  fastify.get('/admin/order-types', { preHandler: verifyAdmin }, async (_request, reply) => {
    const types = await orderTypeRepository.findAll()
    return reply.send(successResponse(types))
  })

  fastify.post('/admin/order-types', { preHandler: verifyAdmin }, async (request, reply) => {
    const parse = typeSchema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, parse.error.errors[0].message))
    const type = await orderTypeRepository.create(parse.data as any)
    return reply.code(201).send(successResponse(type))
  })

  fastify.put('/admin/order-types/:id', { preHandler: verifyAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parse = typeSchema.partial().safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, parse.error.errors[0].message))
    const type = await orderTypeRepository.update(id, parse.data as any)
    return reply.send(successResponse(type))
  })

  fastify.delete('/admin/order-types/:id', { preHandler: verifyAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const count = await orderTypeRepository.countOrders(id)
    if (count > 0) {
      return reply.code(409).send(errorResponse('CONFLICT', `该类型已有 ${count} 个订单，不能删除，请改为下架`))
    }
    await orderTypeRepository.remove(id)
    return reply.send(successResponse({ deleted: true }))
  })
}
