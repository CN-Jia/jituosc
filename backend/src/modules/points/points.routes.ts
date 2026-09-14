// points 模块用户侧路由（薄层）

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { verifyJWT } from '../../middlewares/auth.middleware.js'
import { successResponse, errorResponse, ERROR_CODES } from '../../framework/response.js'
import { freezePoints, deductFrozen } from './points.service.js'

export async function pointsRoutes(fastify: FastifyInstance) {
  // ── 获取我的邀请信息 ────────────────────────────────────────────
  fastify.get('/points/invite', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { inviteCode: true },
    })
    if (!user) return reply.code(404).send(errorResponse(ERROR_CODES.UNAUTHORIZED, '用户不存在'))

    const [totalInvited, completedFirst] = await Promise.all([
      prisma.user.count({ where: { invitedById: userId } }),
      prisma.user.count({
        where: {
          invitedById: userId,
          productOrders: { some: { status: 'COMPLETED' } },
        },
      }),
    ])

    return reply.send(successResponse({
      inviteCode: user.inviteCode,
      inviteUrl: `https://jituo.cc.cd/register?ref=${user.inviteCode}`,
      totalInvited,
      pendingFirst: totalInvited - completedFirst,
      completedFirst,
    }))
  })

  // ── 获取我邀请的用户列表 ────────────────────────────────────────
  fastify.get('/points/invitees', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const invitees = await prisma.user.findMany({
      where: { invitedById: userId },
      select: {
        nickname: true,
        createdAt: true,
        productOrders: {
          where: { status: 'COMPLETED' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send(successResponse({
      list: invitees.map(u => ({
        nickname: u.nickname,
        registeredAt: u.createdAt,
        firstOrderAt: u.productOrders[0]?.createdAt ?? null,
      })),
    }))
  })

  // ── 获取积分余额 ────────────────────────────────────────────────
  fastify.get('/points/balance', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const balance = await prisma.pointBalance.findUnique({ where: { userId } })
    return reply.send(successResponse({
      totalPoints: balance?.totalPoints ?? 0,
      frozenPoints: balance?.frozenPoints ?? 0,
      availablePoints: (balance?.totalPoints ?? 0) - (balance?.frozenPoints ?? 0),
      lifetimeEarned: balance?.lifetimeEarned ?? 0,
    }))
  })

  // ── 获取积分明细 ────────────────────────────────────────────────
  fastify.get('/points/logs', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const q = request.query as Record<string, string>
    const page = Math.max(1, Number(q.page) || 1)
    const pageSize = Math.min(50, Math.max(1, Number(q.pageSize) || 20))

    const [total, list] = await Promise.all([
      prisma.pointLog.count({ where: { userId } }),
      prisma.pointLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, eventType: true, delta: true, balance: true, remark: true, createdAt: true },
      }),
    ])

    return reply.send(successResponse({ total, list }))
  })

  // ── 商城商品列表（公开）────────────────────────────────────────
  fastify.get('/shop/items', async (request, reply) => {
    const q = request.query as Record<string, string>
    const where: Record<string, unknown> = { isActive: true }
    if (q.type === 'SERVICE' || q.type === 'COUPON') where['type'] = q.type

    const list = await prisma.shopItem.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true, name: true, description: true, coverUrl: true,
        type: true, pointsCost: true, stock: true, discountAmt: true,
      },
    })

    return reply.send(successResponse({ list }))
  })

  // ── 提交兑换申请（自动生效，无需审核）───────────────────────────
  fastify.post('/shop/redeem', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const schema = z.object({ shopItemId: z.string().min(1) })
    const parse = schema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '参数错误'))

    const { shopItemId } = parse.data

    const item = await prisma.shopItem.findUnique({ where: { id: shopItemId } })
    if (!item || !item.isActive) return reply.code(404).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '商品不存在或已下架'))
    if (item.stock === 0) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '商品库存不足'))

    const balance = await prisma.pointBalance.findUnique({ where: { userId } })
    if (!balance || balance.totalPoints < item.pointsCost) {
      return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '积分不足'))
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + (item.type === 'SERVICE' ? 30 : 7))

    const redeemOrder = await prisma.redeemOrder.create({
      data: { userId, shopItemId, pointsCost: item.pointsCost, status: 'COMPLETED', expiresAt },
    })

    await freezePoints(userId, item.pointsCost, redeemOrder.id)
    await deductFrozen(userId, item.pointsCost, redeemOrder.id)

    if (item.type === 'COUPON' && item.discountAmt) {
      const crypto = await import('node:crypto')
      let code = ''
      for (let i = 0; i < 10; i++) {
        code = 'JT' + crypto.randomBytes(3).toString('hex').toUpperCase()
        const exists = await prisma.coupon.findUnique({ where: { code } })
        if (!exists) break
      }
      await prisma.coupon.create({
        data: {
          code,
          userId,
          redeemOrderId: redeemOrder.id,
          discountAmt: item.discountAmt,
          expiresAt,
        },
      })
    }

    if (item.stock > 0) {
      await prisma.shopItem.update({ where: { id: shopItemId }, data: { stock: { decrement: 1 } } })
    }

    return reply.code(201).send(successResponse({
      redeemOrderId: redeemOrder.id,
      status: 'COMPLETED',
      expiresAt,
      pointsCost: item.pointsCost,
      message: '兑换成功！请在有效期内使用',
    }))
  })

  // ── 获取用户可用的兑换项（提交需求时选择）──────────────────────
  fastify.get('/redeem/available', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const now = new Date()

    const items = await prisma.redeemOrder.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        usedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      include: {
        shopItem: { select: { id: true, name: true, type: true, discountAmt: true, description: true } },
        coupon: { select: { discountAmt: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const usable = items.filter(r => r.shopItem !== null || r.coupon !== null)

    const formatted = usable.map(r => ({
      id: r.id,
      shopItemId: r.shopItemId,
      name: r.shopItem?.name ?? r.prizeName ?? '转盘奖品',
      type: r.shopItem?.type ?? 'SERVICE',
      discountAmt: r.shopItem?.discountAmt ?? r.coupon?.discountAmt ?? null,
      description: r.shopItem?.description ?? '🎰 转盘中奖获得',
      expiresAt: r.expiresAt,
      pointsCost: r.pointsCost,
      isWheelPrize: !r.shopItemId,
    }))

    return reply.send(successResponse(formatted))
  })

  // ── 我的兑换记录 ────────────────────────────────────────────────
  fastify.get('/shop/redeem/my', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const list = await prisma.redeemOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        shopItem: { select: { name: true, type: true } },
        coupon: { select: { code: true, discountAmt: true, status: true, expiresAt: true } },
        spinResult: { select: { redeemCode: true, isRedeemed: true } },
      },
    })

    return reply.send(successResponse({
      list: list.map(o => ({
        id: o.id,
        shopItem: o.shopItem,
        prizeName: o.prizeName,
        isWheelPrize: !!o.spinResultId,
        pointsCost: o.pointsCost,
        status: o.status,
        adminNote: o.adminNote,
        coupon: o.coupon,
        redeemCode: o.spinResult?.redeemCode ?? null,
        isRedeemed: o.spinResult?.isRedeemed ?? null,
        createdAt: o.createdAt,
      })),
    }))
  })

  // ── 我的优惠券 ──────────────────────────────────────────────────
  fastify.get('/coupons/my', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const list = await prisma.coupon.findMany({
      where: { userId },
      orderBy: [{ status: 'asc' }, { expiresAt: 'asc' }],
      select: { id: true, code: true, discountAmt: true, status: true, expiresAt: true, usedAt: true },
    })
    return reply.send(successResponse({ list }))
  })
}
