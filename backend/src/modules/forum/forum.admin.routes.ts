// forum 模块管理侧路由：帖子审核、置顶、删除、评论管理

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { successResponse, errorResponse, ERROR_CODES } from '../../framework/response.js'
import { verifyAdmin } from '../../middlewares/auth.middleware.js'

export async function adminForumRoutes(fastify: FastifyInstance) {
  fastify.get('/admin/posts', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { page = '1', pageSize = '20', status, board } = request.query as Record<string, string>
    const where: any = {}
    if (status) where.status = status
    if (board) where.board = board

    const [list, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        include: {
          author: { select: { nickname: true, email: true } },
          _count: { select: { comments: true } },
        },
      }),
      prisma.post.count({ where }),
    ])
    return reply.send(successResponse({ list, total }))
  })

  fastify.post('/admin/posts', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const schema = z.object({
      title: z.string().min(2).max(100),
      summary: z.string().max(200).optional(),
      content: z.string().min(1),
      cover: z.string().url().optional(),
      isPinned: z.boolean().optional().default(false),
      board: z.enum(['announcement', 'service', 'faq', 'exchange']).optional().default('exchange'),
    })
    const parse = schema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '参数错误'))

    const post = await prisma.post.create({
      data: { ...parse.data, type: 'DISCUSSION', status: 'APPROVED' },
    })
    return reply.code(201).send(successResponse(post))
  })

  fastify.put('/admin/posts/:id', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const schema = z.object({
      title: z.string().min(2).max(100).optional(),
      summary: z.string().max(200).optional(),
      content: z.string().min(1).optional(),
      cover: z.string().optional(),
      board: z.enum(['announcement', 'service', 'faq', 'exchange']).optional(),
    })
    const parse = schema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '参数错误'))

    const post = await prisma.post.update({ where: { id }, data: parse.data })
    return reply.send(successResponse(post))
  })

  const updateStatusSchema = z.object({ status: z.enum(['APPROVED', 'REJECTED']) })

  fastify.patch('/admin/posts/:id/status', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parse = updateStatusSchema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '状态值无效'))
    const post = await prisma.post.update({ where: { id }, data: { status: parse.data.status } })
    return reply.send(successResponse(post))
  })

  fastify.patch('/admin/posts/:id/pin', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = await prisma.post.findUnique({ where: { id }, select: { isPinned: true } })
    if (!existing) return reply.code(404).send(errorResponse(ERROR_CODES.NOT_FOUND, '帖子不存在'))

    const post = await prisma.post.update({
      where: { id },
      data: { isPinned: !existing.isPinned },
    })
    return reply.send(successResponse({ isPinned: post.isPinned }))
  })

  fastify.delete('/admin/posts/:id', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await prisma.post.delete({ where: { id } })
    return reply.send(successResponse({ message: '已删除' }))
  })

  const updateCommentSchema = z.object({ isHidden: z.boolean() })

  fastify.patch('/admin/comments/:id', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parse = updateCommentSchema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '参数错误'))
    const comment = await prisma.comment.update({ where: { id }, data: { isHidden: parse.data.isHidden } })
    return reply.send(successResponse(comment))
  })

  fastify.delete('/admin/comments/:id', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await prisma.comment.delete({ where: { id } })
    return reply.send(successResponse({ message: '已删除' }))
  })
}
