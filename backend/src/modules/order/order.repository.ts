// order 模块数据访问层：封装 Order / OrderType / StatusHistory 的 Prisma 读写。
// 出参使用 select/include 白名单（VO），避免直接暴露整个模型。

import { prisma } from '../../lib/prisma.js'
import { Order, OrderStatus, OrderType, Prisma } from '@prisma/client'

// ─── OrderType ───────────────────────────────────────────────

export const orderTypeRepository = {
  /** 激活中的需求类型（用户侧） */
  findActive() {
    return prisma.orderType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, description: true, price: true },
    })
  },

  /** 全部需求类型（管理侧） */
  findAll() {
    return prisma.orderType.findMany({ orderBy: { sortOrder: 'asc' } })
  },

  findById(id: string) {
    return prisma.orderType.findUnique({ where: { id } })
  },

  create(data: Prisma.OrderTypeCreateInput) {
    return prisma.orderType.create({ data })
  },

  update(id: string, data: Prisma.OrderTypeUpdateInput) {
    return prisma.orderType.update({ where: { id }, data })
  },

  remove(id: string) {
    return prisma.orderType.delete({ where: { id } })
  },

  countOrders(orderTypeId: string) {
    return prisma.order.count({ where: { orderTypeId } })
  },
}

// ─── Order ───────────────────────────────────────────────────

export const orderRepository = {
  /** 创建订单（事务内，含状态历史） */
  create(data: Prisma.OrderCreateInput): Promise<Order> {
    return prisma.order.create({ data })
  },

  findById(id: string) {
    return prisma.order.findUnique({ where: { id } })
  },

  findByIdOrThrow(id: string) {
    return prisma.order.findUniqueOrThrow({ where: { id } })
  },

  /** 带订单类型/用户/状态历史的完整查询（管理侧/状态流转用） */
  findWithRelations(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: { orderType: true, user: { select: { id: true, nickname: true, invitedById: true } } },
    })
  },

  update(id: string, data: Prisma.OrderUpdateInput) {
    return prisma.order.update({ where: { id }, data })
  },

  createStatusHistory(data: Prisma.StatusHistoryCreateInput) {
    return prisma.statusHistory.create({ data })
  },
}

// ─── VO 查询（用户/管理列表与详情）───────────────────────────

/** 我的订单列表（用户侧 VO） */
export function findMyOrders(userId: string, skip: number, take: number, status?: OrderStatus) {
  const where = { userId, ...(status ? { status } : {}) }
  return Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' as const },
      skip,
      take,
      select: {
        id: true, orderNo: true, courseName: true, status: true,
        grade: true, deadline: true, createdAt: true, quotedPrice: true,
        orderType: { select: { name: true, price: true } },
      },
    }),
    prisma.order.count({ where }),
  ])
}

/** 订单详情（用户/管理员视角，含状态历史与订单类型） */
export function findOrderDetail(orderId: string, userId?: string) {
  const where = userId ? { id: orderId, userId } : { id: orderId }
  return prisma.order.findFirst({
    where,
    include: {
      orderType: { select: { id: true, name: true, price: true } },
      statusHistory: { orderBy: { createdAt: 'asc' as const } },
    },
  })
}

/** 管理员订单列表（含状态汇总统计） */
export async function findAdminOrders(
  where: Prisma.OrderWhereInput,
  skip: number,
  take: number,
) {
  const [list, total, pending, accepted, inProgress, completed, closed] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' as const },
      skip,
      take,
      include: { orderType: { select: { name: true } } },
    }),
    prisma.order.count({ where }),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.order.count({ where: { status: 'ACCEPTED' } }),
    prisma.order.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.order.count({ where: { status: 'COMPLETED' } }),
    prisma.order.count({ where: { status: 'CLOSED' } }),
  ])
  return {
    list, total, skip, take,
    stats: { PENDING: pending, ACCEPTED: accepted, IN_PROGRESS: inProgress, COMPLETED: completed, CLOSED: closed },
  }
}

/** 管理员订单完整详情 */
export function findAdminOrderDetail(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      orderType: true,
      statusHistory: { orderBy: { createdAt: 'asc' as const } },
      notifications: { orderBy: { createdAt: 'desc' as const } },
    },
  })
}

/** 统计口径的计数查询 */
export function countOrdersByStatus(status: OrderStatus) {
  return prisma.order.count({ where: { status } })
}

export function countOrdersCreatedSince(since: Date) {
  return prisma.order.count({ where: { createdAt: { gte: since } } })
}

export function countCompletedSince(since: Date) {
  return prisma.order.count({ where: { status: 'COMPLETED', updatedAt: { gte: since } } })
}

export function countAllOrders() {
  return prisma.order.count({})
}

export function findRecentOrders(take: number) {
  return prisma.order.findMany({
    orderBy: { createdAt: 'desc' as const },
    take,
    select: {
      id: true, orderNo: true, courseName: true, status: true, createdAt: true,
      orderType: { select: { name: true } },
    },
  })
}

export { OrderType }
