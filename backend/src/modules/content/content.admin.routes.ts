// content 模块管理侧路由：活动、轮播、反馈管理

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { successResponse, errorResponse, ERROR_CODES } from '../../framework/response.js'
import { verifyAdmin } from '../../middlewares/auth.middleware.js'
import { sendFeedbackReply } from '../../services/email.service.js'

export async function adminContentRoutes(fastify: FastifyInstance) {
  // ── 活动管理 ─────────────────────────────────────────────────
  const activitySchema = z.object({
    title: z.string().min(1).max(100),
    content: z.string().min(1),
    type: z.enum(['PROMO', 'NOTICE']),
    startAt: z.string().datetime(),
    endAt: z.string().datetime().optional().nullable(),
    isActive: z.boolean().default(true),
  })

  fastify.get('/admin/activities', { preHandler: verifyAdmin }, async (_request, reply) => {
    const list = await prisma.activity.findMany({ orderBy: { startAt: 'desc' } })
    return reply.send(successResponse(list))
  })

  fastify.post('/admin/activities', { preHandler: verifyAdmin }, async (request, reply) => {
    const parse = activitySchema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, parse.error.errors[0].message))
    const data = parse.data
    const activity = await prisma.activity.create({
      data: {
        ...data,
        startAt: new Date(data.startAt),
        endAt: data.endAt ? new Date(data.endAt) : null,
      },
    })
    return reply.code(201).send(successResponse(activity))
  })

  fastify.put('/admin/activities/:id', { preHandler: verifyAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parse = activitySchema.partial().safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, parse.error.errors[0].message))
    const data = parse.data
    const activity = await prisma.activity.update({
      where: { id },
      data: {
        ...data,
        startAt: data.startAt ? new Date(data.startAt) : undefined,
        endAt: data.endAt !== undefined ? (data.endAt ? new Date(data.endAt) : null) : undefined,
      },
    })
    return reply.send(successResponse(activity))
  })

  fastify.delete('/admin/activities/:id', { preHandler: verifyAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await prisma.activity.delete({ where: { id } })
    return reply.send(successResponse({ deleted: true }))
  })

  // ── 作品轮播管理 ─────────────────────────────────────────────
  fastify.get('/admin/carousel', { preHandler: [verifyAdmin] }, async (_request, reply) => {
    const list = await prisma.carousel.findMany({ orderBy: { sortOrder: 'asc' } })
    return reply.send(successResponse(list))
  })

  fastify.post('/admin/carousel', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const schema = z.object({
      imageUrl: z.string().url(),
      courseName: z.string().min(1),
      orderType: z.string().min(1),
      completedAt: z.string().datetime(),
      review: z.string().optional(),
      orderNoMask: z.string().optional(),
      sortOrder: z.number().default(0),
      isActive: z.boolean().default(true),
    })
    const parse = schema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '参数错误'))

    const item = await prisma.carousel.create({
      data: { ...parse.data, completedAt: new Date(parse.data.completedAt) },
    })
    return reply.code(201).send(successResponse(item))
  })

  fastify.put('/admin/carousel/:id', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const schema = z.object({
      imageUrl: z.string().url().optional(),
      courseName: z.string().optional(),
      orderType: z.string().optional(),
      completedAt: z.string().datetime().optional(),
      review: z.string().optional(),
      orderNoMask: z.string().optional(),
      sortOrder: z.number().optional(),
      isActive: z.boolean().optional(),
    })
    const parse = schema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '参数错误'))

    const data: any = { ...parse.data }
    if (data.completedAt) data.completedAt = new Date(data.completedAt)

    const item = await prisma.carousel.update({ where: { id }, data })
    return reply.send(successResponse(item))
  })

  fastify.delete('/admin/carousel/:id', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await prisma.carousel.delete({ where: { id } })
    return reply.send(successResponse({ message: '已删除' }))
  })

  // ── 反馈管理 ─────────────────────────────────────────────────
  fastify.get('/admin/feedback', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { page = '1', pageSize = '20', status, type } = request.query as Record<string, string>
    const where: any = {}
    if (status) where.status = status
    if (type) where.type = type

    const [list, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        include: { user: { select: { nickname: true, email: true, username: true } } },
      }),
      prisma.feedback.count({ where }),
    ])
    return reply.send(successResponse({ list, total }))
  })

  fastify.post('/admin/feedback/:id/reply', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const schema = z.object({ reply: z.string().min(1) })
    const parse = schema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '回复内容不能为空'))

    const fb = await prisma.feedback.findUnique({
      where: { id },
      include: { user: { select: { email: true } } },
    })
    if (!fb) return reply.code(404).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '反馈不存在'))

    const updated = await prisma.feedback.update({
      where: { id },
      data: { adminReply: parse.data.reply, repliedAt: new Date(), status: 'REPLIED' },
    })

    sendFeedbackReply(fb.user.email, fb.title, parse.data.reply).catch(() => {})

    return reply.send(successResponse(updated))
  })

  const updateStatusSchema = z.object({ status: z.enum(['PENDING', 'REPLIED', 'RESOLVED']) })

  fastify.patch('/admin/feedback/:id/status', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parse = updateStatusSchema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '状态值无效'))
    const updated = await prisma.feedback.update({ where: { id }, data: { status: parse.data.status } })
    return reply.send(successResponse(updated))
  })
}
