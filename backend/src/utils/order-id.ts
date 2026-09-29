import { customAlphabet } from 'nanoid'

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const nanoid4 = customAlphabet(alphabet, 4)

/**
 * 生成唯一订单号，格式：JT-YYYYMMDD-XXXX
 * 例：JT-20260419-A3F2
 */
export function generateOrderNo(): string {
  const now = new Date()
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('')
  return `JT-${date}-${nanoid4()}`
}
