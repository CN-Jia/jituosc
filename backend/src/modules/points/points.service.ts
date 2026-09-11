// points 模块业务逻辑：邀请码、积分发放/调整/冻结/解冻、首单判定

import crypto from 'crypto'
import { prisma } from '../../lib/prisma.js'
import { PointEventType } from '@prisma/client'
import { HttpError } from '../../framework/errors.js'
import { ERROR_CODES } from '../../framework/response.js'

// 生成6位大写字母+数字邀请码（加密安全），碰撞时自动重试
export async function generateInviteCode(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  for (let attempt = 0; attempt < 10; attempt++) {
    const bytes = crypto.randomBytes(6)
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars[bytes[i] % chars.length]
    }
    const exists = await prisma.user.findUnique({ where: { inviteCode: code } })
    if (!exists) return code
  }
  throw new HttpError(ERROR_CODES.INTERNAL_ERROR, '邀请码生成失败', 500)
}

// 根据事件类型查积分规则（首次访问时若无规则则 seed 默认值）
async function getRulePoints(eventType: PointEventType): Promise<number | null> {
  let rule = await prisma.pointRule.findUnique({ where: { eventType } })
  if (!rule) {
    const defaults: Partial<Record<PointEventType, number>> = {
      INVITE_REGISTER: 50,
      INVITE_FIRST_ORDER: 100,
      NEW_USER_FIRST_ORDER: 30,
    }
    const defaultPoints = defaults[eventType]
    if (defaultPoints === undefined) return null
    rule = await prisma.pointRule.upsert({
      where: { eventType },
      create: { eventType, points: defaultPoints },
      update: {},
    })
  }
  if (!rule.enabled) return null
  return rule.points
}

// 发放积分（奖励类事件）
export async function awardPoints(
  userId: string,
  eventType: PointEventType,
  refId?: string,
  remark?: string,
): Promise<void> {
  const points = await getRulePoints(eventType)
  if (points === null || points <= 0) return

  await prisma.$transaction(async (tx) => {
    const balance = await tx.pointBalance.upsert({
      where: { userId },
      create: {
        userId,
        totalPoints: points,
        lifetimeEarned: points,
      },
      update: {
        totalPoints: { increment: points },
        lifetimeEarned: { increment: points },
      },
    })

    await tx.pointLog.create({
      data: {
        userId,
        eventType,
        delta: points,
        balance: balance.totalPoints,
        remark: remark ?? null,
        refId: refId ?? null,
      },
    })
  })
}

// 手动调整积分（管理员操作，delta 可正可负）
export async function adjustPoints(
  userId: string,
  delta: number,
  remark?: string,
): Promise<number> {
  if (delta === 0) throw new HttpError(ERROR_CODES.VALIDATION_ERROR, '调整量不能为0', 400)

  return await prisma.$transaction(async (tx) => {
    // 行锁防止并发
    const rows = await tx.$queryRaw<Array<{ totalPoints: number }>>`SELECT "totalPoints" FROM "point_balances" WHERE "userId" = ${userId} FOR UPDATE`
    const currentTotal = rows[0]?.totalPoints ?? 0

    if (delta < 0 && currentTotal + delta < 0) {
      throw new HttpError(ERROR_CODES.INSUFFICIENT_POINTS, '积分不足，调整后余额不能为负', 400)
    }

    const balance = await tx.pointBalance.upsert({
      where: { userId },
      create: {
        userId,
        totalPoints: Math.max(0, delta),
        lifetimeEarned: delta > 0 ? delta : 0,
      },
      update: {
        totalPoints: { increment: delta },
        ...(delta > 0 && { lifetimeEarned: { increment: delta } }),
      },
    })

    await tx.pointLog.create({
      data: {
        userId,
        eventType: PointEventType.ADMIN_ADJUST,
        delta,
        balance: balance.totalPoints,
        remark: remark ?? null,
      },
    })

    return balance.totalPoints
  })
}

// 兑换冻结：totalPoints -= amount, frozenPoints += amount
export async function freezePoints(
  userId: string,
  amount: number,
  redeemOrderId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 行锁防止并发双花
    const rows = await tx.$queryRaw<Array<{ totalPoints: number }>>`SELECT "totalPoints" FROM "point_balances" WHERE "userId" = ${userId} FOR UPDATE`
    const totalPoints = rows[0]?.totalPoints ?? 0
    if (totalPoints < amount) {
      throw new HttpError(ERROR_CODES.INSUFFICIENT_POINTS, '积分不足', 400)
    }

    await tx.pointBalance.update({
      where: { userId },
      data: {
        totalPoints: { decrement: amount },
        frozenPoints: { increment: amount },
      },
    })

    await tx.pointLog.create({
      data: {
        userId,
        eventType: PointEventType.REDEEM_FREEZE,
        delta: -amount,
        balance: totalPoints - amount,
        refId: redeemOrderId,
        remark: '兑换申请冻结积分',
      },
    })
  })
}

// 审核通过：从 frozenPoints 正式扣减
export async function deductFrozen(
  userId: string,
  amount: number,
  redeemOrderId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.pointBalance.update({
      where: { userId },
      data: { frozenPoints: { decrement: amount } },
    })

    const updated = await tx.pointBalance.findUnique({ where: { userId } })
    await tx.pointLog.create({
      data: {
        userId,
        eventType: PointEventType.REDEEM_DEDUCT,
        delta: -amount,
        balance: updated!.totalPoints,
        refId: redeemOrderId,
        remark: '兑换审核通过，积分扣减',
      },
    })
  })
}

// 审核拒绝：解冻积分
export async function unfreeze(
  userId: string,
  amount: number,
  redeemOrderId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const balance = await tx.pointBalance.update({
      where: { userId },
      data: {
        totalPoints: { increment: amount },
        frozenPoints: { decrement: amount },
      },
    })

    await tx.pointLog.create({
      data: {
        userId,
        eventType: PointEventType.REDEEM_UNFREEZE,
        delta: amount,
        balance: balance.totalPoints,
        refId: redeemOrderId,
        remark: '兑换审核拒绝，积分解冻归还',
      },
    })
  })
}

export async function isFirstCompletedOrder(userId: string): Promise<boolean> {
  const count = await prisma.order.count({
    where: { userId, status: 'COMPLETED' },
  })
  return count <= 1
}
