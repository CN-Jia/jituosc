import 'dotenv/config'
import os from 'os'
import Fastify from 'fastify'
import { env } from './config/env.js'
import { logger } from './utils/logger.js'

// 插件
import jwtPlugin from './plugins/jwt.js'
import corsPlugin from './plugins/cors.js'

// 模块路由（按业务域聚合，见 docs/refactor-plan.md）
import { authRoutes } from './modules/system/system.routes.js'
import { adminSystemRoutes } from './modules/system/system.admin.routes.js'
import { orderRoutes } from './modules/order/order.routes.js'
import { adminOrderRoutes } from './modules/order/order.admin.routes.js'
import { pointsRoutes } from './modules/points/points.routes.js'
import { adminPointsRoutes } from './modules/points/points.admin.routes.js'
import { productRoutes } from './modules/product/product.routes.js'
import { adminProductRoutes } from './modules/product/product.admin.routes.js'
import { forumRoutes } from './modules/forum/forum.routes.js'
import { adminForumRoutes } from './modules/forum/forum.admin.routes.js'
import { contentRoutes } from './modules/content/content.routes.js'
import { adminContentRoutes } from './modules/content/content.admin.routes.js'
import { marketingRoutes } from './modules/marketing/marketing.routes.js'
import { adminMarketingRoutes } from './modules/marketing/marketing.admin.routes.js'

import { rateLimitQuery } from './middlewares/ratelimit.middleware.js'
import { toHttpError } from './framework/errors.js'
import { errorResponse } from './framework/response.js'

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : true,
  })

  await app.register(corsPlugin)
  await app.register(jwtPlugin)

  app.get('/health', async () => ({
    ok: true,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(os.uptime()),
  }))

  // 公开配置（前端获取管理员微信号等）
  app.get('/api/config', async () => ({
    success: true,
    data: { adminWechatId: env.ADMIN_WECHAT_ID },
  }))

  // 限流：提交订单
  app.addHook('preHandler', async (request, reply) => {
    if (request.method === 'POST' && request.url === '/api/orders') {
      await rateLimitQuery(request, reply)
    }
  })

  // 模块路由注册（统一 /api 前缀）
  const modules = [
    authRoutes, adminSystemRoutes,
    orderRoutes, adminOrderRoutes,
    pointsRoutes, adminPointsRoutes,
    productRoutes, adminProductRoutes,
    forumRoutes, adminForumRoutes,
    contentRoutes, adminContentRoutes,
    marketingRoutes, adminMarketingRoutes,
  ]
  for (const routes of modules) {
    app.register(routes, { prefix: '/api' })
  }

  // 全局错误处理（统一识别业务错误码 → HTTP 状态码）
  app.setErrorHandler((error, _request, reply) => {
    const httpError = toHttpError(error)
    if (httpError.statusCode >= 500) {
      app.log.error(error)
    }
    reply.code(httpError.statusCode).send(errorResponse(httpError.code, httpError.message))
  })

  return app
}

if (process.env.NODE_ENV !== 'test') {
  buildApp().then(app => {
    app.listen({ port: env.PORT, host: '0.0.0.0' }, (err) => {
      if (err) { app.log.error(err); process.exit(1) }
      logger.info(`🚀 JT-Hub API running at http://localhost:${env.PORT}`)
    })
  })
}
