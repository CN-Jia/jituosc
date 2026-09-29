// thesis 模块公开路由：站点漂浮字、活动列表、毕设进度查询。
//
// 薄层约定：Zod 校验（dto）→ 调用 service → 统一响应（successResponse）。
// 本文件不出现任何 prisma 调用、不写业务逻辑。

import { FastifyInstance } from 'fastify'
import { successResponse } from '../../framework/response.js'
import { parseDto } from '../../framework/validation.js'
import { thesisQueryDto } from './thesis.dto.js'
import * as thesisService from './thesis.service.js'

export async function thesisRoutes(fastify: FastifyInstance) {
  // 站点漂浮字
  fastify.get('/thesis/site-notice', async () => {
    return successResponse(await thesisService.getPublicSiteNotice())
  })

  // 活动列表（仅已发布）
  fastify.get('/thesis/activities', async () => {
    const activities = await thesisService.listPublishedActivities()
    return successResponse({ activities })
  })

  // 毕设进度查询（题目 + 6 位验证码）
  fastify.post('/thesis/projects/query', async (request) => {
    const input = parseDto(thesisQueryDto, request.body)
    return successResponse(await thesisService.queryProgress(input))
  })
}
