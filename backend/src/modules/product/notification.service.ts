// product 模块：管理员站内通知（AdminNotification 关联商品订单）

import { prisma } from '../../lib/prisma.js'
import { AdminNotifyType } from '@prisma/client'

export async function createAdminNotification(params: {
  type: AdminNotifyType
  summary: string
  orderId?: string
}) {
  return prisma.adminNotification.create({ data: params })
}

export async function getAdminNotifications(unreadOnly: boolean, limit: number) {
  const where = unreadOnly ? { isRead: false } : {}
  const [notifications, unreadCount] = await Promise.all([
    prisma.adminNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        order: { select: { orderNo: true } },
      },
    }),
    prisma.adminNotification.count({ where: { isRead: false } }),
  ])
  return { notifications, unreadCount }
}

export async function markNotificationRead(id: string) {
  return prisma.adminNotification.update({ where: { id }, data: { isRead: true } })
}

export async function markAllRead() {
  const result = await prisma.adminNotification.updateMany({
    where: { isRead: false },
    data: { isRead: true },
  })
  return result.count
}
