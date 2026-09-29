// order 模块通知：管理端站内通知 + Server酱 推送 + 通知日志
// （合并原 notify.service 与 serverchan.service）
//
// ⚠️ 线上实测发现的问题：原来 `if (!env.SERVERCHAN_TOKEN) return` 是**静默跳过** ——
//    生产环境 SERVERCHAN_TOKEN 为空，于是「用户下单」既没有外部推送、也没有任何站内记录，
//    管理员完全不知道有新订单（notifications 表 0 行）。现在改为：
//    ① 永远写一条管理端站内通知（不依赖任何外部服务）；② 配了 token 再额外推送。

import axios from 'axios'
import { Order, OrderType } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { env } from '../../config/env.js'
import { logger } from '../../utils/logger.js'
import { createAdminNotification } from '../product/notification.service.js'

type OrderWithType = Order & { orderType?: OrderType | null }

let warnedNoServerChan = false

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
  const title = `[极拓空间] 新需求：${order.courseName}`
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
  const title = `[极拓空间] 订单状态变更：${statusLabels[newStatus] ?? newStatus}`
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
  // ① 站内通知：不依赖外部服务，管理端铃铛一定看得到
  const typeName = order.orderType?.name ?? order.orderTypeId
  const deadlineStr = new Date(order.deadline).toLocaleDateString('zh-CN')
  await createAdminNotification({
    type: 'NEW_ORDER',
    summary: `新需求 ${order.orderNo}：${order.courseName}（${typeName}，截止 ${deadlineStr}，微信 ${order.contactWechat}）`,
  }).catch((err) => {
    logger.error({ err, orderNo: order.orderNo }, '写入管理端站内通知失败')
  })

  // ② Server酱 推送：没配就明确告警一次，而不是静默什么都不做
  if (!env.SERVERCHAN_TOKEN) {
    if (!warnedNoServerChan) {
      warnedNoServerChan = true
      logger.warn('SERVERCHAN_TOKEN 未配置：新订单只写站内通知，不会推送到微信（配置后可获得微信提醒）')
    }
    await logNotify(order.id, 'SERVERCHAN', 'NEW_ORDER', 'SKIPPED', 'SERVERCHAN_TOKEN 未配置')
    return
  }

  try {
    await pushAdminNewOrder(order)
    await logNotify(order.id, 'SERVERCHAN', 'NEW_ORDER', 'SUCCESS')
  } catch (err) {
    logger.error({ err, orderNo: order.orderNo }, 'Server酱 推送失败')
    await logNotify(order.id, 'SERVERCHAN', 'NEW_ORDER', 'FAILED', String(err))
  }
}

export async function notifyAdminStatusChange(order: OrderWithType, newStatus: string): Promise<void> {
  if (!env.SERVERCHAN_TOKEN) return
  try {
    await pushAdminStatusChange(order, newStatus)
    await logNotify(order.id, 'SERVERCHAN', 'STATUS_CHANGE', 'SUCCESS')
  } catch (err) {
    logger.error({ err, orderNo: order.orderNo }, 'Server酱 状态变更推送失败')
    await logNotify(order.id, 'SERVERCHAN', 'STATUS_CHANGE', 'FAILED', String(err))
  }
}
