// forum 模块用户侧路由：帖子与评论

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { successResponse, errorResponse, ERROR_CODES } from '../../framework/response.js'
import { verifyJWT } from '../../middlewares/auth.middleware.js'

export async function forumRoutes(fastify: FastifyInstance) {
  fastify.get('/posts', async (request, reply) => {
    const { page = '1', pageSize = '10', board } = request.query as Record<string, string>
    const where: any = { status: 'APPROVED' }
    if (board && ['announcement', 'service', 'faq', 'exchange'].includes(board)) {
      where.board = board
    }

    const [list, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: [
          { isPinned: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        select: {
          id: true, title: true, summary: true, cover: true,
          isPinned: true, createdAt: true,
          author: { select: { nickname: true } },
          _count: { select: { comments: { where: { isHidden: false } } } },
        },
      }),
      prisma.post.count({ where }),
    ])
    return reply.send(successResponse({ list, total, page: Number(page), pageSize: Number(pageSize) }))
  })

  fastify.get('/posts/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const post = await prisma.post.findFirst({
      where: { id, status: 'APPROVED' },
      include: {
        author: { select: { nickname: true } },
        comments: {
          where: { isHidden: false },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, content: true, createdAt: true, userId: true,
            user: { select: { nickname: true, grade: true } },
          },
        },
      },
    })
    if (!post) return reply.code(404).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '帖子不存在'))
    return reply.send(successResponse(post))
  })

  fastify.post('/posts', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user?.emailVerified) {
      return reply.code(403).send(errorResponse(ERROR_CODES.FORBIDDEN, '请先完成邮箱验证'))
    }

    const schema = z.object({
      title: z.string().min(2).max(100),
      summary: z.string().max(200).optional(),
      content: z.string().min(10),
      cover: z.string().url().optional(),
    })
    const parse = schema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, parse.error.errors[0]?.message ?? '参数错误'))

    const post = await prisma.post.create({
      data: { ...parse.data, type: 'DISCUSSION', status: 'PENDING', board: 'exchange', authorId: userId },
    })
    return reply.code(201).send(successResponse({ id: post.id, message: '发布成功，等待管理员审核' }))
  })

  fastify.post('/posts/:id/comments', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id: postId } = request.params as { id: string }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user?.emailVerified) {
      return reply.code(403).send(errorResponse(ERROR_CODES.FORBIDDEN, '请先完成邮箱验证'))
    }

    const post = await prisma.post.findFirst({ where: { id: postId, status: 'APPROVED' } })
    if (!post) return reply.code(404).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '帖子不存在'))

    const schema = z.object({ content: z.string().min(1).max(1000) })
    const parse = schema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '评论内容不能为空'))

    const comment = await prisma.comment.create({
      data: { postId, userId, content: parse.data.content },
      include: { user: { select: { nickname: true } } },
    })
    return reply.code(201).send(successResponse(comment))
  })

  fastify.delete('/posts/:postId/comments/:commentId', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { commentId } = request.params as { postId: string; commentId: string }

    const comment = await prisma.comment.findUnique({ where: { id: commentId } })
    if (!comment) return reply.code(404).send(errorResponse(ERROR_CODES.NOT_FOUND, '评论不存在'))
    if (comment.userId !== userId) return reply.code(403).send(errorResponse(ERROR_CODES.FORBIDDEN, '无权删除他人评论'))

    await prisma.comment.delete({ where: { id: commentId } })
    return reply.send(successResponse({ deleted: true }))
  })
}
