// content 模块用户侧路由：活动公告、作品轮播、用户反馈

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { successResponse, errorResponse, ERROR_CODES } from '../../framework/response.js'
import { verifyJWT } from '../../middlewares/auth.middleware.js'

export async function contentRoutes(fastify: FastifyInstance) {
  // 获取活动/公告列表（公开，含已过期活动，支持分页）
  fastify.get('/activities', async (request, reply) => {
    const now = new Date()
    const q = request.query as Record<string, string>
    const page = Math.max(1, Number(q.page) || 1)
    const pageSize = Math.min(Math.max(1, Number(q.pageSize) || 20), 50)
    const skip = (page - 1) * pageSize
    const typeFilter = q.type ? { type: q.type as 'PROMO' | 'NOTICE' } : {}

    const [list, total] = await Promise.all([
      prisma.activity.findMany({
        where: {
          isActive: true,
          startAt: { lte: now },
          ...typeFilter,
        },
        orderBy: { startAt: 'desc' },
        skip,
        take: pageSize,
        select: { id: true, title: true, content: true, type: true, startAt: true, endAt: true },
      }),
      prisma.activity.count({
        where: { isActive: true, startAt: { lte: now }, ...typeFilter },
      }),
    ])

    const enriched = list.map(item => {
      const isExpired = item.endAt != null && item.endAt < now
      const daysLeft = item.endAt == null
        ? null
        : isExpired
          ? 0
          : Math.ceil((item.endAt.getTime() - now.getTime()) / 86_400_000)
      return { ...item, isExpired, daysLeft }
    })

    return reply.send(successResponse({ list: enriched, total, page, pageSize }))
  })

  // 作品轮播（公开）
  fastify.get('/carousel', async (_request, reply) => {
    const list = await prisma.carousel.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, imageUrl: true, courseName: true, orderType: true, completedAt: true, review: true, orderNoMask: true },
    })
    return reply.send(successResponse(list))
  })

  // 提交反馈
  fastify.post('/feedback', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const schema = z.object({
      type: z.enum(['BUG', 'SUGGESTION', 'OTHER']),
      title: z.string().min(2).max(100),
      description: z.string().min(10, '详细描述至少需要10个字符'),
    })
    const parse = schema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, parse.error.errors[0]?.message ?? '参数错误'))

    const fb = await prisma.feedback.create({ data: { userId, ...parse.data } })
    return reply.code(201).send(successResponse({ id: fb.id, message: '反馈已提交' }))
  })

  // 我的反馈列表
  fastify.get('/feedback/my', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { page = '1', pageSize = '10' } = request.query as Record<string, string>

    const [list, total] = await Promise.all([
      prisma.feedback.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        select: { id: true, type: true, title: true, status: true, adminReply: true, repliedAt: true, createdAt: true },
      }),
      prisma.feedback.count({ where: { userId } }),
    ])
    return reply.send(successResponse({ list, total }))
  })

  // 反馈详情
  fastify.get('/feedback/:id', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id } = request.params as { id: string }

    const fb = await prisma.feedback.findFirst({
      where: { id, userId },
      select: { id: true, type: true, title: true, description: true, status: true, adminReply: true, repliedAt: true, createdAt: true },
    })
    if (!fb) return reply.code(404).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '反馈不存在'))
    return reply.send(successResponse(fb))
  })
}
