// thesis 模块管理路由：题目/进度/截图/活动/通知管理（复用极拓管理员鉴权）

import { FastifyInstance } from 'fastify'
import { nanoid } from 'nanoid'
import fs from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { prisma } from '../../lib/prisma.js'
import { verifyAdmin } from '../../middlewares/auth.middleware.js'
import { generateUniqueCode } from './thesis.service.js'

export async function adminThesisRoutes(fastify: FastifyInstance) {
  // ── 题目 ─────────────────────────────────────────────────────
  fastify.get('/admin/thesis/projects', { preHandler: verifyAdmin }, async () => {
    const projects = await prisma.thesisProject.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { progresses: true } } },
    })
    return { projects }
  })

  fastify.post('/admin/thesis/projects', { preHandler: verifyAdmin }, async (req, reply) => {
    const body = req.body as any
    const title = (body.title ?? '').toString().trim()
    const studentName = (body.studentName ?? '').toString().trim()
    if (!title || !studentName) {
      return reply.code(400).send({ message: '题目和姓名不能为空' })
    }
    const existing = await prisma.thesisProject.findUnique({ where: { title } })
    if (existing) {
      return reply.code(409).send({ message: '题目已存在' })
    }
    const uniqueCode = await generateUniqueCode()
    const project = await prisma.thesisProject.create({
      data: {
        title,
        uniqueCode,
        studentName,
        studentNo: body.studentNo ?? null,
        advisor: body.advisor ?? null,
        major: body.major ?? null,
      },
    })
    return { project }
  })

  fastify.put('/admin/thesis/projects/:id', { preHandler: verifyAdmin }, async (req) => {
    const params = req.params as any
    const body = req.body as any
    const data: any = {}
    if (body.title !== undefined) data.title = body.title
    if (body.studentName !== undefined) data.studentName = body.studentName
    if (body.studentNo !== undefined) data.studentNo = body.studentNo
    if (body.advisor !== undefined) data.advisor = body.advisor
    if (body.major !== undefined) data.major = body.major
    const project = await prisma.thesisProject.update({ where: { id: Number(params.id) }, data })
    return { project }
  })

  fastify.delete('/admin/thesis/projects/:id', { preHandler: verifyAdmin }, async (req) => {
    const params = req.params as any
    await prisma.thesisProject.delete({ where: { id: Number(params.id) } })
    return { ok: true }
  })

  fastify.get('/admin/thesis/projects/:id', { preHandler: verifyAdmin }, async (req, reply) => {
    const params = req.params as any
    const project = await prisma.thesisProject.findUnique({
      where: { id: Number(params.id) },
      include: {
        progresses: {
          orderBy: { createdAt: 'desc' },
          include: { images: { orderBy: { createdAt: 'asc' } } },
        },
      },
    })
    if (!project) return reply.code(404).send({ message: '未找到该题目' })
    return { project }
  })

  // ── 进度 ─────────────────────────────────────────────────────
  fastify.post('/admin/thesis/projects/:id/progress', { preHandler: verifyAdmin }, async (req, reply) => {
    const params = req.params as any
    const body = req.body as any
    const title = (body.title ?? '').toString().trim()
    if (!title) return reply.code(400).send({ message: '进度标题不能为空' })
    if (body.percent === undefined || body.percent === null || body.percent === '') {
      return reply.code(400).send({ message: '进度百分比不能为空' })
    }
    const progress = await prisma.thesisProgress.create({
      data: {
        projectId: Number(params.id),
        title,
        percent: Number(body.percent),
        content: body.content ?? null,
      },
    })
    return { progress }
  })

  fastify.delete('/admin/thesis/progress/:id', { preHandler: verifyAdmin }, async (req) => {
    const params = req.params as any
    await prisma.thesisProgress.delete({ where: { id: Number(params.id) } })
    return { ok: true }
  })

  // ── 截图上传 ─────────────────────────────────────────────────
  fastify.post('/admin/thesis/progress/:id/images', { preHandler: verifyAdmin }, async (req, reply) => {
    const params = req.params as any
    const data = await req.file()
    if (!data) return reply.code(400).send({ message: '未上传文件' })
    const ext = path.extname(data.filename) || '.png'
    const name = nanoid(12) + ext
    const uploadDir = path.join(process.cwd(), 'uploads')
    fs.mkdirSync(uploadDir, { recursive: true })
    const writeStream = fs.createWriteStream(path.join(uploadDir, name))
    await pipeline(data.file, writeStream)
    const image = await prisma.thesisProgressImage.create({
      data: { progressId: Number(params.id), filename: data.filename, url: '/uploads/' + name },
    })
    return { image }
  })

  fastify.delete('/admin/thesis/images/:id', { preHandler: verifyAdmin }, async (req) => {
    const params = req.params as any
    await prisma.thesisProgressImage.delete({ where: { id: Number(params.id) } })
    return { ok: true }
  })

  // ── 活动 ─────────────────────────────────────────────────────
  fastify.get('/admin/thesis/activities', { preHandler: verifyAdmin }, async () => {
    const activities = await prisma.thesisActivity.findMany({ orderBy: { createdAt: 'desc' } })
    return { activities }
  })

  fastify.post('/admin/thesis/activities', { preHandler: verifyAdmin }, async (req, reply) => {
    const body = req.body as any
    const title = (body.title ?? '').toString().trim()
    if (!title) return reply.code(400).send({ message: '活动标题不能为空' })
    const activity = await prisma.thesisActivity.create({
      data: {
        title,
        content: body.content ?? null,
        published: body.published === undefined ? true : Boolean(body.published),
      },
    })
    return { activity }
  })

  fastify.put('/admin/thesis/activities/:id', { preHandler: verifyAdmin }, async (req) => {
    const params = req.params as any
    const body = req.body as any
    const data: any = {}
    if (body.title !== undefined) data.title = body.title
    if (body.content !== undefined) data.content = body.content
    if (body.published !== undefined) data.published = Boolean(body.published)
    const activity = await prisma.thesisActivity.update({ where: { id: Number(params.id) }, data })
    return { activity }
  })

  fastify.delete('/admin/thesis/activities/:id', { preHandler: verifyAdmin }, async (req) => {
    const params = req.params as any
    await prisma.thesisActivity.delete({ where: { id: Number(params.id) } })
    return { ok: true }
  })

  // ── 漂浮字 ───────────────────────────────────────────────────
  fastify.get('/admin/thesis/notice', { preHandler: verifyAdmin }, async () => {
    const notice = await prisma.siteNotice.findFirst()
    return { notice }
  })

  fastify.put('/admin/thesis/notice', { preHandler: verifyAdmin }, async (req) => {
    const body = req.body as any
    const data = {
      text: body.text ?? '',
      enabled: body.enabled === undefined ? true : Boolean(body.enabled),
    }
    const existing = await prisma.siteNotice.findFirst()
    const notice = existing
      ? await prisma.siteNotice.update({ where: { id: existing.id }, data })
      : await prisma.siteNotice.create({ data })
    return { notice }
  })
}
