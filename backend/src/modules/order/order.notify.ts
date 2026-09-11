// order 模块通知：Server酱 推送 + 通知日志（合并原 notify.service 与 serverchan.service）

import axios from 'axios'
import { Order, OrderType } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { env } from '../../config/env.js'

type OrderWithType = Order & { orderType?: OrderType | null }

// ─── Server酱 底层推送 ────────────────────────────────────────

async function pushServerChan(title: string, content: string): Promise<void> {
  if (!env.SERVERCHAN_TOKEN) throw new Error('SERVERCHAN_TOKEN 未配置')
  await axios.post(`https://sctapi.ftqq.com/${env.SERVERCHAN_TOKEN}.send`, null, {
    params: { title, desp: content },
  })
}

async function pushAdminNewOrder(order: Order & { orderType?: { name: string } | null }): Promise<void> {
  const deadlineStr = new Date(order.deadline).toLocaleDateString('zh-CN')
  const gradeMap: Record<string, string> = { FRESHMAN: '大一', SOPHOMORE: '大二', JUNIOR: '大三' }
  const title = `[JT-Hub] 新需求：${order.courseName}`
  const content = `
**订单号**：${order.orderNo}
**课程**：${order.courseName}
**类型**：${order.orderType?.name ?? order.orderTypeId}
**年级**：${gradeMap[order.grade] ?? order.grade}
**截止**：${deadlineStr}
**联系微信**：${order.contactWechat}
**来源**：${order.source === 'MINIPROGRAM' ? '小程序' : 'PC网页'}
  `.trim()
  await pushServerChan(title, content)
}

async function pushAdminStatusChange(
  order: Order & { orderType?: { name: string } | null },
  newStatus: string,
): Promise<void> {
  const statusLabels: Record<string, string> = {
    ACCEPTED: '已接单',
    IN_PROGRESS: '进行中',
    COMPLETED: '已完成',
    CLOSED: '已关闭',
  }
  const title = `[JT-Hub] 订单状态变更：${statusLabels[newStatus] ?? newStatus}`
  const content = `
**订单号**：${order.orderNo}
**课程**：${order.courseName}
**联系微信**：${order.contactWechat}
**新状态**：${statusLabels[newStatus] ?? newStatus}
  `.trim()
  await pushServerChan(title, content)
}

// ─── 通知日志 ─────────────────────────────────────────────────

async function logNotify(
  orderId: string,
  channel: 'SERVERCHAN' | 'WECOM',
  type: 'NEW_ORDER' | 'STATUS_CHANGE',
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED',
  error?: string,
  userId?: string,
) {
  await prisma.notification.create({
    data: { orderId, channel, type, status, error: error ?? null, userId: userId ?? null },
  }).catch(() => { /* 日志写入失败不影响主流程 */ })
}

// ─── 对外通知方法 ─────────────────────────────────────────────

export async function notifyAdminNewOrder(order: OrderWithType): Promise<void> {
  if (!env.SERVERCHAN_TOKEN) return
  try {
    await pushAdminNewOrder(order)
    await logNotify(order.id, 'SERVERCHAN', 'NEW_ORDER', 'SUCCESS')
  } catch (err) {
    await logNotify(order.id, 'SERVERCHAN', 'NEW_ORDER', 'FAILED', String(err))
  }
}

export async function notifyAdminStatusChange(order: OrderWithType, newStatus: string): Promise<void> {
  if (!env.SERVERCHAN_TOKEN) return
  try {
    await pushAdminStatusChange(order, newStatus)
    await logNotify(order.id, 'SERVERCHAN', 'STATUS_CHANGE', 'SUCCESS')
  } catch (err) {
    await logNotify(order.id, 'SERVERCHAN', 'STATUS_CHANGE', 'FAILED', String(err))
  }
}
