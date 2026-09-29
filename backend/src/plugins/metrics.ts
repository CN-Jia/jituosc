// 指标采集插件：采集 HTTP 与 Node 进程指标，并通过 GET /metrics 暴露给 Prometheus。
//
// 指标清单
// - http_requests_total{method,route,status}          请求量（按路由模板聚合）
// - http_request_duration_seconds{method,route,status} 响应时间直方图（可算 P95/P99）
// - http_requests_in_flight                            正在处理的请求数
// - process_* / nodejs_*（prom-client 默认指标）        CPU、内存、Event Loop 延迟、GC、句柄等
//
// 安全：/metrics 不应公网可达。生产上后端端口只绑定 127.0.0.1（见 compose），
// 且 Nginx 对 /metrics 直接返回 404（见 nginx 配置）；Prometheus 与后端同机抓取。

import fp from 'fastify-plugin'
import type { FastifyRequest } from 'fastify'
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client'

export const metricsRegistry = new Registry()

// Node 进程/运行时默认指标（CPU、内存、事件循环、GC、句柄数等）
collectDefaultMetrics({ register: metricsRegistry })

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'HTTP 请求总数',
  labelNames: ['method', 'route', 'status'],
  registers: [metricsRegistry],
})

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP 请求处理耗时（秒）',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
})

const httpRequestsInFlight = new Gauge({
  name: 'http_requests_in_flight',
  help: '正在处理中的 HTTP 请求数',
  registers: [metricsRegistry],
})

/** 请求开始时间挂在请求对象上，避免额外的并发数据结构 */
const START_AT = Symbol('metricsStartAt')

/**
 * 取「路由模板」而不是真实 URL 作为标签。
 * 否则 /api/orders/<随机 id> 这类请求会让标签基数爆炸（Prometheus 最怕这个）。
 * 未匹配到路由（404）统一记为 unmatched。
 */
function routeLabel(request: FastifyRequest): string {
  const req = request as unknown as {
    routeOptions?: { url?: string }
    routerPath?: string
  }
  return req.routeOptions?.url ?? req.routerPath ?? 'unmatched'
}

export default fp(async (fastify) => {
  fastify.addHook('onRequest', async (request) => {
    httpRequestsInFlight.inc()
    ;(request as unknown as Record<symbol, bigint>)[START_AT] = process.hrtime.bigint()
  })

  fastify.addHook('onResponse', async (request, reply) => {
    httpRequestsInFlight.dec()

    const route = routeLabel(request)
    // 抓取自身不计入业务指标，避免自噪声
    if (route === '/metrics') return

    const labels = {
      method: request.method,
      route,
      status: String(reply.statusCode),
    }
    httpRequestsTotal.inc(labels)

    const startedAt = (request as unknown as Record<symbol, bigint | undefined>)[START_AT]
    if (startedAt !== undefined) {
      const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9
      httpRequestDuration.observe(labels, seconds)
    }
  })

  fastify.get('/metrics', async (_request, reply) => {
    reply.header('Content-Type', metricsRegistry.contentType)
    return metricsRegistry.metrics()
  })
})
