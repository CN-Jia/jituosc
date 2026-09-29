// /metrics 端点的集成测试：验证指标确实被采集、标签基数受控、且抓取自身不计入业务指标。
// 这些断言全部不依赖数据库。

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../src/app.js'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
  // 预热：直方图/计数器只有在有观测后才会渲染出样本行（否则只有 # HELP/# TYPE）
  await app.inject({ method: 'GET', url: '/health' })
})

afterAll(async () => {
  await app.close()
})

async function scrape(): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/metrics' })
  expect(res.statusCode).toBe(200)
  return res.body
}

describe('GET /metrics', () => {
  it('以 Prometheus 文本格式返回，并带正确 Content-Type', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/plain')
    expect(res.body).toContain('# HELP')
    expect(res.body).toContain('# TYPE')
  })

  it('暴露自定义 HTTP 指标（请求量 + 响应时间直方图 + 在途请求）', async () => {
    const body = await scrape()
    expect(body).toContain('http_requests_total')
    expect(body).toContain('http_request_duration_seconds_bucket')
    expect(body).toContain('http_requests_in_flight')
  })

  it('暴露 Node 进程指标（CPU / 内存 / Event Loop / GC）', async () => {
    const body = await scrape()
    expect(body).toContain('process_cpu_seconds_total')
    expect(body).toContain('process_resident_memory_bytes')
    expect(body).toContain('nodejs_eventloop_lag_seconds')
    expect(body).toContain('nodejs_heap_size_used_bytes')
  })

  it('记录真实请求：/health 会被按路由模板统计', async () => {
    await app.inject({ method: 'GET', url: '/health' })
    const body = await scrape()
    expect(body).toMatch(/http_requests_total\{[^}]*route="\/health"[^}]*status="200"[^}]*\}/)
  })

  it('未匹配的路径记为 unmatched —— 防止随机 URL 打爆标签基数', async () => {
    await app.inject({ method: 'GET', url: '/api/definitely-not-a-route-12345' })
    const body = await scrape()
    expect(body).toContain('route="unmatched"')
    // 真实 URL 不应作为标签出现
    expect(body).not.toContain('definitely-not-a-route-12345')
  })

  it('抓取 /metrics 自身不会被计入业务指标（避免自噪声）', async () => {
    await scrape()
    await scrape()
    const body = await scrape()
    expect(body).not.toMatch(/route="\/metrics"/)
  })

  it('按路由模板聚合：真实存在的路由会以模板名出现', async () => {
    // 用 /api/config（直接读环境变量，不碰数据库）验证路由标签
    await app.inject({ method: 'GET', url: '/api/config' })
    const body = await scrape()
    expect(body).toMatch(/route="\/api\/config"/)
  })
})
