// order 模块业务逻辑：订单创建、状态流转、报价折扣、统计、完成后的积分联动。

import { Order, OrderStatus, OrderSource, Grade } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { generateOrderNo } from '../../utils/order-id.js'
import { isValidTransition, STATUS_LABELS } from '../../utils/order-status.js'
import { ERROR_CODES } from '../../framework/response.js'
import { HttpError, notFound, unprocessable } from '../../framework/errors.js'
import {
  orderRepository,
  orderTypeRepository,
  findMyOrders,
  findOrderDetail,
  findAdminOrders,
  findAdminOrderDetail,
  countOrdersByStatus,
  countOrdersCreatedSince,
  countCompletedSince,
  countAllOrders,
  findRecentOrders,
} from './order.repository.js'
import { awardPoints, isFirstCompletedOrder } from '../points/points.service.js'
import { notifyAdminStatusChange } from './order.notify.js'

export interface CreateOrderInput {
  courseName: string
  orderTypeId: string
  grade: Grade
  deadline: Date
  contactWechat: string
  source: OrderSource
  userId?: string
  redeemItemId?: string
  couponId?: string
}

/** 创建订单（含服务套餐/转盘折扣核销） */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const orderNo = generateOrderNo()
  return prisma.$transaction(async (tx) => {
    let quotedPrice: string | undefined
    const notes: string[] = []

    // 验证并使用服务套餐兑换（含转盘中奖折扣）
    if (input.redeemItemId && input.userId) {
      const redeemOrder = await tx.redeemOrder.findFirst({
        where: {
          id: input.redeemItemId,
          userId: input.userId,
          status: 'COMPLETED',
          usedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: {
          shopItem: { select: { name: true, discountAmt: true } },
          coupon: { select: { discountAmt: true } },
        },
      })
      if (!redeemOrder) {
        throw new HttpError(ERROR_CODES.VALIDATION_ERROR, '服务套餐不可用或已过期', 400)
      }

      const itemName = redeemOrder.shopItem?.name ?? redeemOrder.prizeName ?? '转盘奖品'
      const rawDiscount = redeemOrder.shopItem?.discountAmt ?? redeemOrder.coupon?.discountAmt
      const discountAmt = rawDiscount ? Number(rawDiscount) : 0

      if (discountAmt === 0) {
        quotedPrice = '0'
        notes.push(`[服务套餐: ${itemName}（免费兑换）]`)
      } else {
        notes.push(`[服务套餐: ${itemName}（折扣¥${discountAmt}）]`)
      }
    }

    const order = await tx.order.create({
      data: {
        orderNo,
        courseName: input.courseName,
        orderTypeId: input.orderTypeId,
        grade: input.grade,
        deadline: input.deadline,
        contactWechat: input.contactWechat,
        source: input.source,
        status: 'PENDING',
        userId: input.userId ?? null,
        redeemItemId: input.redeemItemId ?? null,
        adminNote: notes.length > 0 ? notes.join(' ') : null,
        ...(quotedPrice !== undefined && { quotedPrice }),
      },
    })

    if (input.redeemItemId) {
      await tx.redeemOrder.update({
        where: { id: input.redeemItemId },
        data: { usedAt: new Date(), usedOrderId: order.id },
      })
    }

    await tx.statusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: null,
        toStatus: 'PENDING',
        operator: 'system',
        remark: '订单创建',
      },
    })
    return order
  })
}

/** 校验并取激活的需求类型（创建订单前置校验） */
export async function assertActiveOrderType(orderTypeId: string) {
  const orderType = await orderTypeRepository.findById(orderTypeId)
  if (!orderType || !orderType.isActive) {
    throw new HttpError(ERROR_CODES.VALIDATION_ERROR, '无效的需求类型', 400)
  }
  return orderType
}

/** 小程序端查询该用户的订单列表 */
export async function getMyOrders(userId: string, page = 1, pageSize = 20, status?: OrderStatus) {
  const skip = (page - 1) * pageSize
  const [list, total] = await findMyOrders(userId, skip, pageSize, status)
  return { list, total, page, pageSize }
}

/** 查询单个订单详情（用户视角，不含 adminNote） */
export async function getOrderDetail(orderId: string, userId?: string) {
  const order = await findOrderDetail(orderId, userId)
  if (!order) return null

  let redeemService: { name: string; discountAmt: number; isFree: boolean } | null = null
  if (order.redeemItemId) {
    const redeemOrder = await prisma.redeemOrder.findUnique({
      where: { id: order.redeemItemId },
      include: {
        shopItem: { select: { name: true, discountAmt: true } },
        coupon: { select: { discountAmt: true } },
      },
    })
    if (redeemOrder) {
      const itemName = redeemOrder.shopItem?.name ?? redeemOrder.prizeName ?? '转盘奖品'
      const rawDiscount = redeemOrder.shopItem?.discountAmt ?? redeemOrder.coupon?.discountAmt
      const discountAmt = rawDiscount ? Number(rawDiscount) : 0
      redeemService = { name: itemName, discountAmt, isFree: discountAmt === 0 }
    }
  }

  return { ...order, redeemService }
}

/** 管理员查询订单列表（含各状态汇总） */
export async function adminListOrders(filters: {
  status?: OrderStatus
  keyword?: string
  page?: number
  pageSize?: number
}) {
  const { status, keyword, page = 1, pageSize = 20 } = filters
  const skip = (page - 1) * pageSize
  const where = {
    ...(status ? { status } : {}),
    ...(keyword ? {
      OR: [
        { courseName: { contains: keyword, mode: 'insensitive' as const } },
        { orderNo: { contains: keyword, mode: 'insensitive' as const } },
        { contactWechat: { contains: keyword, mode: 'insensitive' as const } },
      ],
    } : {}),
  }
  const result = await findAdminOrders(where, skip, pageSize)
  return { list: result.list, total: result.total, page, pageSize, stats: result.stats }
}

/** 管理员查看订单完整详情 */
export async function adminGetOrderDetail(orderId: string) {
  return findAdminOrderDetail(orderId)
}

/** 管理员更新订单状态（校验状态机） */
export async function updateOrderStatus(
  orderId: string,
  toStatus: OrderStatus,
  remark?: string,
): Promise<Order> {
  const order = await orderRepository.findByIdOrThrow(orderId)
  if (!isValidTransition(order.status, toStatus)) {
    throw unprocessable(
      `${STATUS_LABELS[order.status]} 不能变更为 ${STATUS_LABELS[toStatus]}`,
      ERROR_CODES.INVALID_STATUS_TRANSITION,
    )
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: toStatus },
    })
    await tx.statusHistory.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus,
        operator: 'admin',
        remark: remark ?? null,
      },
    })
    return updated
  })
}

/** 管理员添加内部备注 */
export async function addAdminNote(orderId: string, note: string): Promise<Order> {
  return orderRepository.update(orderId, { adminNote: note })
}

/** 管理员设置报价（若订单含折扣服务，自动扣减折扣） */
export async function setQuotedPrice(orderId: string, price: string): Promise<Order> {
  const order = await orderRepository.findById(orderId)
  if (!order) throw notFound('订单不存在', ERROR_CODES.ORDER_NOT_FOUND)

  let finalPrice = price
  let noteAddition = ''

  if (order.redeemItemId) {
    const redeemOrder = await prisma.redeemOrder.findUnique({
      where: { id: order.redeemItemId },
      include: {
        shopItem: { select: { discountAmt: true } },
        coupon: { select: { discountAmt: true } },
      },
    })
    const rawDiscount = redeemOrder?.shopItem?.discountAmt ?? redeemOrder?.coupon?.discountAmt
    const discountAmt = rawDiscount ? Number(rawDiscount) : 0
    if (discountAmt > 0) {
      const original = parseFloat(price)
      const final = Math.max(0, original - discountAmt)
      finalPrice = final.toFixed(2)
      noteAddition = ` [原价¥${price}，折扣抵扣¥${discountAmt}，实付¥${finalPrice}]`
    }
  }

  return orderRepository.update(orderId, {
    quotedPrice: finalPrice,
    ...(noteAddition ? { adminNote: (order.adminNote ?? '') + noteAddition } : {}),
  })
}

/** 获取统计数据（监控大屏） */
export async function getStats() {
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0)

  const [
    pending, accepted, inProgress, completed, closed,
    todayNew, todayCompleted,
    weekNew, weekCompleted,
    total,
    recentOrders,
  ] = await Promise.all([
    countOrdersByStatus('PENDING'),
    countOrdersByStatus('ACCEPTED'),
    countOrdersByStatus('IN_PROGRESS'),
    countOrdersByStatus('COMPLETED'),
    countOrdersByStatus('CLOSED'),
    countOrdersCreatedSince(todayStart),
    countCompletedSince(todayStart),
    countOrdersCreatedSince(weekStart),
    countCompletedSince(weekStart),
    countAllOrders(),
    findRecentOrders(5),
  ])

  return {
    today: { new: todayNew, completed: todayCompleted },
    thisWeek: { new: weekNew, completed: weekCompleted },
    total,
    byStatus: { PENDING: pending, ACCEPTED: accepted, IN_PROGRESS: inProgress, COMPLETED: completed, CLOSED: closed },
    recentOrders,
  }
}

/** 状态更新 + 附加字段 + 通知 + 完成积分联动（从 admin 路由下沉的业务编排） */
export async function updateOrderStatusWithSideEffects(
  id: string,
  status: OrderStatus,
  options: { remark?: string; estimatedDelivery?: string; rewardPoints?: number } = {},
) {
  const { remark, estimatedDelivery, rewardPoints } = options

  if (status === 'IN_PROGRESS' && !estimatedDelivery) {
    throw new HttpError(ERROR_CODES.VALIDATION_ERROR, '进行中状态必须填写预计交付时间', 400)
  }

  const order = await updateOrderStatus(id, status, remark)
  const orderWithType = await orderRepository.findWithRelations(id)

  const updateData: Record<string, unknown> = {}
  if (status === 'IN_PROGRESS' && estimatedDelivery) {
    updateData.estimatedDelivery = new Date(estimatedDelivery)
  }
  if (status === 'COMPLETED') {
    const price = order.quotedPrice ? parseFloat(order.quotedPrice) : 0
    const rate = orderWithType?.orderType?.pointRewardRate ? Number(orderWithType.orderType.pointRewardRate) : 0.05
    const calculatedPoints = Math.floor(price * rate * 100)
    updateData.rewardPoints = rewardPoints ?? Math.max(calculatedPoints, 0)
  }
  if (Object.keys(updateData).length > 0) {
    await orderRepository.update(id, updateData)
  }

  if (orderWithType) {
    notifyAdminStatusChange(orderWithType, status).catch(() => {})
  }

  if (status === 'COMPLETED' && orderWithType?.userId) {
    const userId = orderWithType.userId
    const finalRewardPoints = (updateData.rewardPoints as number | undefined) ?? 0

    if (finalRewardPoints > 0) {
      awardPoints(userId, 'ORDER_COMPLETED', id, `订单 ${order.orderNo} 完成奖励`).catch(() => {})
    }

    const isFirst = await isFirstCompletedOrder(userId)
    if (isFirst) {
      awardPoints(userId, 'NEW_USER_FIRST_ORDER', id, '首笔订单完成奖励').catch(() => {})
      const invitedById = orderWithType.user?.invitedById
      if (invitedById) {
        const inviterNickname = orderWithType.user?.nickname ?? '用户'
        awardPoints(invitedById, 'INVITE_FIRST_ORDER', id, `被邀请用户「${inviterNickname}」完成首单`).catch(() => {})
      }
    }
  }

  return {
    orderNo: order.orderNo,
    status: order.status,
    estimatedDelivery: updateData.estimatedDelivery as Date | undefined,
    rewardPoints: updateData.rewardPoints as number | undefined,
  }
}
