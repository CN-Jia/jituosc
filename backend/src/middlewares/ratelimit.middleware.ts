import { FastifyRequest, FastifyReply } from 'fastify'
import { errorResponse, ERROR_CODES } from '../utils/response.js'

// 简单的内存速率限制（生产环境建议用 @fastify/rate-limit + Redis）
const ipWindowMap = new Map<string, { count: number; resetAt: number }>()

const WINDOW_MS = 60_000  // 1 分钟
const MAX_REQUESTS = 20   // 每 IP 每分钟最多 20 次

export async function rateLimitQuery(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const ip = request.ip
  const now = Date.now()
  const entry = ipWindowMap.get(ip)

  if (!entry || now > entry.resetAt) {
    ipWindowMap.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return
  }

  entry.count++
  if (entry.count > MAX_REQUESTS) {
    reply.status(429).send(
      errorResponse(ERROR_CODES.RATE_LIMITED, '请求过于频繁，请稍后再试', 429),
    )
  }
}

// 定期清理过期条目，防止内存泄漏
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of ipWindowMap) {
    if (now > entry.resetAt) ipWindowMap.delete(ip)
  }
}, 5 * 60_000)
