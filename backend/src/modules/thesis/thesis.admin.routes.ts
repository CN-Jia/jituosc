// thesis 模块管理路由：题目 / 进度 / 截图 / 活动 / 漂浮字。
//
// 薄层约定：verifyAdmin 鉴权 → Zod 校验（dto）→ 调用 service → 统一响应。
// 本文件不出现任何 prisma 调用、不写业务逻辑。

import { FastifyInstance } from 'fastify'
import { badRequest } from '../../framework/errors.js'
import { successResponse } from '../../framework/response.js'
import { parseDto } from '../../framework/validation.js'
import { verifyAdmin } from '../../middlewares/auth.middleware.js'
import { MAX_IMAGE_BYTES } from '../../shared/storage/image-upload.js'
import {
  activityCreateDto,
  activityUpdateDto,
  idParamDto,
  noticeUpdateDto,
  progressCreateDto,
  projectCreateDto,
  projectUpdateDto,
} from './thesis.dto.js'
import * as thesisService from './thesis.service.js'

export async function adminThesisRoutes(fastify: FastifyInstance) {
  // ── 题目 ─────────────────────────────────────────────────────
  fastify.get('/admin/thesis/projects', { preHandler: verifyAdmin }, async () => {
    const projects = await thesisService.listProjects()
    return successResponse({ projects })
  })

  fastify.get('/admin/thesis/projects/:id', { preHandler: verifyAdmin }, async (req) => {
    const { id } = parseDto(idParamDto, req.params)
    const project = await thesisService.getProjectDetail(id)
    return successResponse({ project })
  })

  fastify.post('/admin/thesis/projects', { preHandler: verifyAdmin }, async (req) => {
    const input = parseDto(projectCreateDto, req.body)
    const project = await thesisService.createProject(input)
    return successResponse({ project })
  })

  fastify.put('/admin/thesis/projects/:id', { preHandler: verifyAdmin }, async (req) => {
    const { id } = parseDto(idParamDto, req.params)
    const input = parseDto(projectUpdateDto, req.body)
    const project = await thesisService.updateProject(id, input)
    return successResponse({ project })
  })

  fastify.delete('/admin/thesis/projects/:id', { preHandler: verifyAdmin }, async (req) => {
    const { id } = parseDto(idParamDto, req.params)
    await thesisService.deleteProject(id)
    return successResponse({ ok: true })
  })

  // ── 进度 ─────────────────────────────────────────────────────
  fastify.post('/admin/thesis/projects/:id/progress', { preHandler: verifyAdmin }, async (req) => {
    const { id } = parseDto(idParamDto, req.params)
    const input = parseDto(progressCreateDto, req.body)
    const progress = await thesisService.createProgress(id, input)
    return successResponse({ progress })
  })

  fastify.delete('/admin/thesis/progress/:id', { preHandler: verifyAdmin }, async (req) => {
    const { id } = parseDto(idParamDto, req.params)
    await thesisService.deleteProgress(id)
    return successResponse({ ok: true })
  })

  // ── 截图上传 ─────────────────────────────────────────────────
  fastify.post('/admin/thesis/progress/:id/images', { preHandler: verifyAdmin }, async (req) => {
    const { id } = parseDto(idParamDto, req.params)
    // 在解析层就限制大小：超限时 multipart 会中断读取，不会把整个大文件收进内存
    const file = await req.file({ limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } })
    if (!file) throw badRequest('未上传文件')
    const image = await thesisService.saveProgressImage(id, file)
    return successResponse({ image })
  })

  fastify.delete('/admin/thesis/images/:id', { preHandler: verifyAdmin }, async (req) => {
    const { id } = parseDto(idParamDto, req.params)
    await thesisService.deleteProgressImage(id)
    return successResponse({ ok: true })
  })

  // ── 活动 ─────────────────────────────────────────────────────
  fastify.get('/admin/thesis/activities', { preHandler: verifyAdmin }, async () => {
    const activities = await thesisService.listActivities()
    return successResponse({ activities })
  })

  fastify.post('/admin/thesis/activities', { preHandler: verifyAdmin }, async (req) => {
    const input = parseDto(activityCreateDto, req.body)
    const activity = await thesisService.createActivity(input)
    return successResponse({ activity })
  })

  fastify.put('/admin/thesis/activities/:id', { preHandler: verifyAdmin }, async (req) => {
    const { id } = parseDto(idParamDto, req.params)
    const input = parseDto(activityUpdateDto, req.body)
    const activity = await thesisService.updateActivity(id, input)
    return successResponse({ activity })
  })

  fastify.delete('/admin/thesis/activities/:id', { preHandler: verifyAdmin }, async (req) => {
    const { id } = parseDto(idParamDto, req.params)
    await thesisService.deleteActivity(id)
    return successResponse({ ok: true })
  })

  // ── 漂浮字 ───────────────────────────────────────────────────
  fastify.get('/admin/thesis/notice', { preHandler: verifyAdmin }, async () => {
    const notice = await thesisService.getNotice()
    return successResponse({ notice })
  })

  fastify.put('/admin/thesis/notice', { preHandler: verifyAdmin }, async (req) => {
    const input = parseDto(noticeUpdateDto, req.body)
    const notice = await thesisService.updateNotice(input)
    return successResponse({ notice })
  })
}
