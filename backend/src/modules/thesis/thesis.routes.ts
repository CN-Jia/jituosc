// thesis 模块公开路由：站点通知、活动列表、毕设进度查询

import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { queryProjectProgress, NOT_FOUND_MSG } from './thesis.service.js'

export async function thesisRoutes(fastify: FastifyInstance) {
  // 站点漂浮字
  fastify.get('/thesis/site-notice', async () => {
    const notice = await prisma.siteNotice.findFirst()
    if (!notice) return { text: '', enabled: false }
    return { text: notice.enabled ? notice.text : '', enabled: !!notice.enabled }
  })

  // 活动列表（已发布）
  fastify.get('/thesis/activities', async () => {
    const activities = await prisma.thesisActivity.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
    })
    return { activities }
  })

  // 毕设进度查询（题目 + 6 位验证码）
  fastify.post('/thesis/projects/query', async (request, reply) => {
    const body = request.body as { title?: string; code?: string }
    const t = (body.title ?? '').toString().trim()
    const c = (body.code ?? '').toString().trim()
    if (!t || !c) {
      return reply.code(400).send({ message: NOT_FOUND_MSG })
    }
    const result = await queryProjectProgress(t, c)
    if (!result) {
      return reply.code(404).send({ message: NOT_FOUND_MSG })
    }
    return result
  })
}
