// marketing 模块管理侧路由：转盘奖品、抽奖记录、兑换核销、统计、浮窗

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { verifyAdmin } from '../../middlewares/auth.middleware.js'
import { successResponse, errorResponse, ERROR_CODES } from '../../framework/response.js'

export async function adminMarketingRoutes(fastify: FastifyInstance) {
  // ── 奖品列表 ──────────────────────────────────────────────────
  fastify.get('/admin/wheel/prizes', { preHandler: [verifyAdmin] }, async (_req, reply) => {
    const prizes = await prisma.wheelPrize.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { spinResults: true } } },
    })
    return reply.send(successResponse(prizes))
  })

  // ── 新增奖品 ──────────────────────────────────────────────────
  const createPrizeSchema = z.object({
    label: z.string().min(1).max(50),
    type: z.enum(['CASH_REDEEM', 'ORDER_DISCOUNT', 'NONE']),
    value: z.number().min(0).optional().nullable(),
    weight: z.number().int().min(1).max(100).default(1),
    totalStock: z.number().int().min(-1).default(-1),
    remainStock: z.number().int().min(-1).default(-1),
    color: z.string().default('#2D3748'),
    icon: z.string().default('🎯'),
    sortOrder: z.number().int().default(0),
    isActive: z.boolean().default(true),
  })

  fastify.post('/admin/wheel/prizes', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const parse = createPrizeSchema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, parse.error.errors[0]?.message ?? '参数错误'))

    const prize = await prisma.wheelPrize.create({ data: parse.data })
    return reply.code(201).send(successResponse(prize))
  })

  // ── 修改奖品 ──────────────────────────────────────────────────
  const updatePrizeSchema = z.object({
    label: z.string().min(1).max(50).optional(),
    value: z.number().min(0).optional().nullable(),
    weight: z.number().int().min(1).max(100).optional(),
    totalStock: z.number().int().min(-1).optional(),
    remainStock: z.number().int().min(-1).optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }).strip()

  fastify.put('/admin/wheel/prizes/:id', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parse = updatePrizeSchema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '参数错误'))

    const prize = await prisma.wheelPrize.update({ where: { id }, data: parse.data })
    return reply.send(successResponse(prize))
  })

  // ── 删除奖品 ──────────────────────────────────────────────────
  fastify.delete('/admin/wheel/prizes/:id', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const spinCount = await prisma.spinResult.count({ where: { prizeId: id } })
    if (spinCount > 0) {
      return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, `该奖品已有 ${spinCount} 条抽奖记录，无法删除`))
    }

    await prisma.wheelPrize.delete({ where: { id } })
    return reply.send(successResponse({ ok: true }))
  })

  // ── 发放额外抽奖次数 ──────────────────────────────────────────
  const grantSpinsSchema = z.object({
    userId: z.string().min(1),
    amount: z.number().int().min(1).max(10),
  })

  fastify.post('/admin/wheel/grant-spins', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const parse = grantSpinsSchema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, parse.error.errors[0]?.message ?? '参数错误'))

    const user = await prisma.user.findUnique({ where: { id: parse.data.userId } })
    if (!user) return reply.code(404).send(errorResponse(ERROR_CODES.NOT_FOUND, '用户不存在'))

    const updated = await prisma.user.update({
      where: { id: parse.data.userId },
      data: { extraSpins: { increment: parse.data.amount } },
      select: { id: true, nickname: true, extraSpins: true },
    })

    return reply.send(successResponse(updated))
  })

  // ── 查看用户抽奖详情 ──────────────────────────────────────────
  fastify.get('/admin/wheel/user/:userId', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { userId } = request.params as { userId: string }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nickname: true, username: true, extraSpins: true },
    })
    if (!user) return reply.code(404).send(errorResponse(ERROR_CODES.NOT_FOUND, '用户不存在'))

    const spinResults = await prisma.spinResult.findMany({
      where: { userId },
      orderBy: { spinRound: 'asc' },
      include: { prize: { select: { label: true, type: true } } },
    })

    const inviteCount = await prisma.user.count({ where: { invitedById: userId } })

    return reply.send(successResponse({
      user,
      inviteCount,
      spinResults: spinResults.map(r => ({
        id: r.id,
        spinRound: r.spinRound,
        prizeLabel: r.prize.label,
        prizeType: r.prize.type,
        redeemCode: r.redeemCode,
        isRedeemed: r.isRedeemed,
        createdAt: r.createdAt,
      })),
    }))
  })

  // ── 抽奖记录列表 ──────────────────────────────────────────────
  fastify.get('/admin/wheel/results', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const q = request.query as Record<string, string>
    const page = Math.max(1, Number(q.page) || 1)
    const pageSize = Math.min(50, Math.max(1, Number(q.pageSize) || 20))

    const [total, list] = await Promise.all([
      prisma.spinResult.count(),
      prisma.spinResult.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { nickname: true, username: true } },
          prize: { select: { label: true, type: true, value: true } },
        },
      }),
    ])

    return reply.send(successResponse({
      total,
      list: list.map(r => ({
        id: r.id,
        nickname: r.user.nickname,
        username: r.user.username,
        prizeLabel: r.prize.label,
        prizeType: r.prize.type,
        prizeValue: r.prize.value,
        spinRound: r.spinRound,
        redeemCode: r.redeemCode,
        isRedeemed: r.isRedeemed,
        createdAt: r.createdAt,
      })),
    }))
  })

  // ── 核销兑换码 ────────────────────────────────────────────────
  fastify.post('/admin/wheel/redeem/:id', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const result = await prisma.spinResult.findUnique({ where: { id } })
    if (!result) return reply.code(404).send(errorResponse(ERROR_CODES.NOT_FOUND, '记录不存在'))
    if (!result.redeemCode) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '该记录无兑换码'))
    if (result.isRedeemed) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '该兑换码已核销'))

    await prisma.spinResult.update({
      where: { id },
      data: { isRedeemed: true },
    })

    return reply.send(successResponse({ message: '兑换码已核销' }))
  })

  // ── 转盘统计 ──────────────────────────────────────────────────
  fastify.get('/admin/wheel/stats', { preHandler: [verifyAdmin] }, async (_req, reply) => {
    const [totalSpins, prizeStats, totalUsers, redeemedCount] = await Promise.all([
      prisma.spinResult.count(),
      prisma.spinResult.groupBy({
        by: ['prizeId'],
        _count: { id: true },
      }),
      prisma.spinResult.findMany({
        distinct: ['userId'],
        select: { userId: true },
      }).then(r => r.length),
      prisma.spinResult.count({ where: { isRedeemed: true } }),
    ])

    const prizes = await prisma.wheelPrize.findMany({
      select: { id: true, label: true, type: true },
    })
    const prizeMap = new Map(prizes.map(p => [p.id, p]))

    const prizeBreakdown = prizeStats.map(ps => ({
      label: prizeMap.get(ps.prizeId)?.label ?? '未知',
      type: prizeMap.get(ps.prizeId)?.type ?? '未知',
      count: ps._count.id,
    }))

    return reply.send(successResponse({
      totalSpins,
      totalUsers,
      redeemedCount,
      prizeBreakdown,
    }))
  })

  // ── 获取活动浮窗配置 ──────────────────────────────────────────
  fastify.get('/admin/activity-popup', { preHandler: [verifyAdmin] }, async (_req, reply) => {
    let popup = await prisma.activityPopup.findUnique({ where: { id: 'singleton' } })
    if (!popup) {
      popup = await prisma.activityPopup.create({ data: { id: 'singleton' } })
    }
    return reply.send(successResponse(popup))
  })

  // ── 更新活动浮窗配置 ──────────────────────────────────────────
  const updatePopupSchema = z.object({
    enabled: z.boolean().optional(),
    title: z.string().max(100).optional(),
    description: z.string().max(500).optional(),
    buttonText: z.string().max(50).optional(),
    linkUrl: z.string().max(200).optional(),
    imageUrl: z.string().url().optional().nullable().or(z.literal('')),
    showCondition: z.enum(['all', 'new_user', 'has_spins']).optional(),
  }).transform(data => ({
    ...data,
    imageUrl: data.imageUrl || null,
  }))

  fastify.put('/admin/activity-popup', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const parse = updatePopupSchema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '参数错误'))

    const popup = await prisma.activityPopup.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...parse.data },
      update: parse.data,
    })

    return reply.send(successResponse(popup))
  })
}
