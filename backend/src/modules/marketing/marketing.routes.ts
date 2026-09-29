// marketing 模块用户侧路由：幸运转盘

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '../../lib/prisma.js'
import { verifyJWT } from '../../middlewares/auth.middleware.js'
import { successResponse, errorResponse, ERROR_CODES } from '../../framework/response.js'

// 生成兑换码: JW-XXYYZZ
function generateRedeemCode(): string {
  const bytes = crypto.randomBytes(3)
  return 'JW-' + bytes.toString('hex').toUpperCase()
}

// 加权随机选择奖品（考虑库存和权重）
function weightedRandom(prizes: any[]): any {
  const available = prizes.filter(p => p.totalStock === -1 || p.remainStock > 0)
  if (available.length === 0) return prizes[prizes.length - 1]

  const totalWeight = available.reduce((sum, p) => sum + (p.weight || 1), 0)
  let random = Math.random() * totalWeight

  for (const p of available) {
    random -= (p.weight || 1)
    if (random <= 0) return p
  }

  return available[available.length - 1]
}

export async function marketingRoutes(fastify: FastifyInstance) {
  // ── 获取转盘信息 ──────────────────────────────────────────────
  fastify.get('/lucky-wheel/info', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }

    const [prizes, spinResults, inviteCount, user] = await Promise.all([
      prisma.wheelPrize.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, label: true, type: true, color: true, icon: true },
      }),
      prisma.spinResult.findMany({
        where: { userId },
        orderBy: { spinRound: 'asc' },
        include: { prize: { select: { label: true, type: true } } },
      }),
      prisma.user.count({ where: { invitedById: userId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { extraSpins: true } }),
    ])

    const baseSpins = Math.min(1 + inviteCount, 3)
    const extraSpins = user?.extraSpins ?? 0
    const maxSpins = baseSpins + extraSpins
    const usedSpins = spinResults.length
    const remainingSpins = Math.max(0, maxSpins - usedSpins)

    const history = spinResults.map(r => ({
      prizeLabel: r.prize.label,
      won: r.prize.type !== 'NONE',
      redeemCode: r.redeemCode,
      isRedeemed: r.isRedeemed,
      createdAt: r.createdAt,
    }))

    return reply.send(successResponse({
      prizes,
      remainingSpins,
      maxSpins,
      extraSpins,
      history,
    }))
  })

  // ── 执行抽奖 ──────────────────────────────────────────────────
  fastify.post('/lucky-wheel/spin', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const spinCount = await tx.spinResult.count({ where: { userId } })
        const inviteCount = await tx.user.count({ where: { invitedById: userId } })
        const user = await tx.user.findUnique({ where: { id: userId }, select: { extraSpins: true } })
        const baseSpins = Math.min(1 + inviteCount, 3)
        const extraSpins = user?.extraSpins ?? 0
        const maxSpins = baseSpins + extraSpins

        if (spinCount >= maxSpins) {
          throw new Error('NO_SPINS_LEFT')
        }

        const prizes = await tx.wheelPrize.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        })

        if (prizes.length === 0) {
          throw new Error('NO_PRIZES')
        }

        const winner = weightedRandom(prizes)

        if (winner.totalStock !== -1) {
          await tx.wheelPrize.update({
            where: { id: winner.id },
            data: { remainStock: { decrement: 1 } },
          })
        }

        let redeemCode: string | null = null
        if (winner.type === 'CASH_REDEEM') {
          for (let i = 0; i < 10; i++) {
            const code = generateRedeemCode()
            const exists = await tx.spinResult.findUnique({ where: { redeemCode: code } })
            if (!exists) {
              redeemCode = code
              break
            }
          }
          if (!redeemCode) throw new Error('CODE_GENERATION_FAILED')
        }

        const spinResult = await tx.spinResult.create({
          data: {
            userId,
            prizeId: winner.id,
            spinRound: spinCount + 1,
            redeemCode,
          },
        })

        if (winner.type !== 'NONE') {
          const expiresAt = new Date()
          expiresAt.setDate(expiresAt.getDate() + 60)

          const redeemOrder = await tx.redeemOrder.create({
            data: {
              userId,
              spinResultId: spinResult.id,
              prizeName: winner.label,
              pointsCost: 0,
              status: 'COMPLETED',
              expiresAt,
            },
          })

          if (winner.type === 'ORDER_DISCOUNT' && winner.value) {
            let couponCode = ''
            for (let i = 0; i < 10; i++) {
              const candidate = 'WJ' + crypto.randomBytes(3).toString('hex').toUpperCase()
              const exists = await tx.coupon.findUnique({ where: { code: candidate } })
              if (!exists) { couponCode = candidate; break }
            }
            if (!couponCode) throw new Error('COUPON_CODE_GENERATION_FAILED')
            await tx.coupon.create({
              data: {
                code: couponCode,
                userId,
                redeemOrderId: redeemOrder.id,
                discountAmt: winner.value,
                expiresAt,
              },
            })
          }
        }

        const prizeIndex = prizes.findIndex(p => p.id === winner.id)

        return {
          prizeIndex,
          prize: {
            id: winner.id,
            label: winner.label,
            type: winner.type,
            value: winner.value,
            icon: winner.icon,
          },
          won: winner.type !== 'NONE',
          redeemCode,
          remainingSpins: maxSpins - spinCount - 1,
        }
      })

      return reply.send(successResponse(result))
    } catch (err: any) {
      if (err.message === 'NO_SPINS_LEFT') {
        return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '抽奖次数已用完'))
      }
      if (err.message === 'NO_PRIZES') {
        return reply.code(500).send(errorResponse(ERROR_CODES.INTERNAL_ERROR, '暂无可用奖品'))
      }
      throw err
    }
  })

  // ── 获取浮窗配置（公开）────────────────────────────────────────
  fastify.get('/activity-popup', async (_request, reply) => {
    const popup = await prisma.activityPopup.findUnique({ where: { id: 'singleton' } })
    if (!popup || !popup.enabled) {
      return reply.send(successResponse({ enabled: false }))
    }
    return reply.send(successResponse({
      enabled: true,
      title: popup.title,
      description: popup.description,
      buttonText: popup.buttonText,
      linkUrl: popup.linkUrl,
      imageUrl: popup.imageUrl,
      showCondition: popup.showCondition,
    }))
  })
}
