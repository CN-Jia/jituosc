import { OrderStatus } from '@prisma/client'

// 使用 Record<string, ...> 兼容不同环境的枚举值（生产/开发可能有 ACCEPTED/CLOSED 差异）
export const VALID_TRANSITIONS: Record<string, string[]> = {
  CREATED:     ['PENDING', 'CANCELLED'],
  PENDING:     ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED:   [],
  CANCELLED:   [],
  // 兼容旧数据
  ACCEPTED:    ['IN_PROGRESS', 'CANCELLED'],
  CLOSED:      [],
}

export const STATUS_LABELS: Record<string, string> = {
  CREATED:     '已创建',
  PENDING:     '待接单',
  IN_PROGRESS: '进行中',
  COMPLETED:   '已结单',
  CANCELLED:   '已取消',
  ACCEPTED:    '已接单',
  CLOSED:      '已关闭',
}

export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}
