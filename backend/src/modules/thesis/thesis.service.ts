// thesis 模块业务逻辑层：毕设进度查询、题目/进度/截图/活动/漂浮字的管理。
//
// 约定：
// - 不直接接触 prisma（一律经 thesis.repository.ts）
// - 不直接接触 request/reply（入参由 dto 校验后传入，出参由 vo 整形）
// - 业务失败一律抛 HttpError，由全局 setErrorHandler 转成统一响应

import { randomInt } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { nanoid } from 'nanoid'
import type { MultipartFile } from '@fastify/multipart'

import { conflict, notFound } from '../../framework/errors.js'
import { resolveUploadDir, toUploadUrl, UPLOAD_URL_PREFIX } from '../../shared/storage/paths.js'
import {
  siteNoticeRepository,
  thesisActivityRepository,
  thesisImageRepository,
  thesisProgressRepository,
  thesisProjectRepository,
} from './thesis.repository.js'
import type {
  ActivityCreateInput,
  ActivityUpdateInput,
  NoticeUpdateInput,
  ProgressCreateInput,
  ProjectCreateInput,
  ProjectUpdateInput,
  ThesisQueryInput,
} from './thesis.dto.js'
import {
  toActivityVo,
  toNoticeVo,
  toProgressVo,
  toProjectVo,
  toPublicNoticeVo,
  toQueryResultVo,
} from './thesis.vo.js'
import {
  NOT_FOUND_MSG,
  type PublicSiteNoticeVo,
  type SiteNoticeVo,
  type ThesisActivityVo,
  type ThesisProgressImageVo,
  type ThesisProgressVo,
  type ThesisProjectVo,
  type ThesisQueryResultVo,
} from './thesis.types.js'

export { NOT_FOUND_MSG }

// ─── 内部工具 ────────────────────────────────────────────────

async function ensureProjectExists(id: number): Promise<ThesisProjectVo> {
  const project = await thesisProjectRepository.findById(id)
  if (!project) throw notFound('未找到该题目')
  return project
}

async function ensureProgressExists(id: number): Promise<ThesisProgressVo> {
  const progress = await thesisProgressRepository.findById(id)
  if (!progress) throw notFound('进度记录不存在')
  return progress
}

/**
 * 删除 /uploads/ 下的本地文件（外链 URL 不动）。
 * 只取 URL 的 basename 并校验解析后的路径确实落在上传目录内，避免路径穿越。
 */
async function removeLocalUploadFiles(urls: string[]): Promise<void> {
  const root = path.resolve(resolveUploadDir())
  await Promise.all(
    urls
      .filter((url) => typeof url === 'string' && url.startsWith(UPLOAD_URL_PREFIX))
      .map(async (url) => {
        const name = path.basename(url)
        if (!name || name === '.' || name === '..') return
        const target = path.resolve(root, name)
        if (!target.startsWith(root + path.sep)) return
        await fs.promises.unlink(target).catch(() => {
          // 文件可能已被清理或从未落盘，忽略
        })
      }),
  )
}

/** 收集某题目下所有截图 URL（删除级联前调用） */
function collectImageUrls(progresses: { images: { url: string }[] }[]): string[] {
  return progresses.flatMap((p) => (p.images ?? []).map((img) => img.url))
}

// ─── 公开侧 ──────────────────────────────────────────────────

/** 站点漂浮字（未配置或已关闭时返回空文案） */
export async function getPublicSiteNotice(): Promise<PublicSiteNoticeVo> {
  const notice = await siteNoticeRepository.find()
  return toPublicNoticeVo(notice)
}

/** 已发布的活动列表 */
export async function listPublishedActivities(): Promise<ThesisActivityVo[]> {
  const activities = await thesisActivityRepository.list(true)
  return activities.map(toActivityVo)
}

/**
 * 按题目 + 6 位验证码查询进度。
 * 题目不存在与验证码错误一律抛同一个 404，避免被用来枚举题目。
 */
export async function queryProgress(input: ThesisQueryInput): Promise<ThesisQueryResultVo> {
  const project = await thesisProjectRepository.findByTitleForQuery(input.title)
  if (!project || project.uniqueCode !== input.code) {
    throw notFound(NOT_FOUND_MSG)
  }
  const progresses = await thesisProgressRepository.listByProject(project.id)
  return toQueryResultVo(project, progresses)
}

/** 生成 6 位唯一验证码 */
export async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const code = randomInt(100000, 1000000).toString()
    const existing = await thesisProjectRepository.findByUniqueCode(code)
    if (!existing) return code
  }
  throw new Error('生成唯一验证码失败')
}

// ─── 管理侧：题目 ────────────────────────────────────────────

export async function listProjects(): Promise<ThesisProjectVo[]> {
  const projects = await thesisProjectRepository.list()
  return projects.map(toProjectVo)
}

export async function getProjectDetail(id: number): Promise<ThesisProjectVo & { progresses: ThesisProgressVo[] }> {
  const project = await thesisProjectRepository.findDetailById(id)
  if (!project) throw notFound('未找到该题目')
  return {
    ...toProjectVo(project),
    progresses: (project.progresses ?? []).map(toProgressVo),
  }
}

export async function createProject(input: ProjectCreateInput): Promise<ThesisProjectVo> {
  const existing = await thesisProjectRepository.findByTitle(input.title)
  if (existing) throw conflict('题目已存在')

  const project = await thesisProjectRepository.create({
    title: input.title,
    uniqueCode: await generateUniqueCode(),
    studentName: input.studentName,
    studentNo: input.studentNo ?? null,
    advisor: input.advisor ?? null,
    major: input.major ?? null,
  })
  return toProjectVo(project)
}

export async function updateProject(id: number, input: ProjectUpdateInput): Promise<ThesisProjectVo> {
  await ensureProjectExists(id)
  // 只更新传入的字段：undefined 会被 Prisma 忽略
  const project = await thesisProjectRepository.update(id, input)
  return toProjectVo(project)
}

export async function deleteProject(id: number): Promise<void> {
  const project = await thesisProjectRepository.findDetailById(id)
  if (!project) throw notFound('未找到该题目')

  // 数据库侧靠 onDelete: Cascade 级联，磁盘上的截图需要自己清
  const urls = collectImageUrls(project.progresses ?? [])
  await thesisProjectRepository.remove(id)
  await removeLocalUploadFiles(urls)
}

// ─── 管理侧：进度 ────────────────────────────────────────────

export async function createProgress(projectId: number, input: ProgressCreateInput): Promise<ThesisProgressVo> {
  await ensureProjectExists(projectId)
  const progress = await thesisProgressRepository.create({
    projectId,
    title: input.title,
    percent: input.percent,
    content: input.content ?? null,
  })
  return toProgressVo(progress)
}

export async function deleteProgress(id: number): Promise<void> {
  const progress = await ensureProgressExists(id)
  const urls = collectImageUrls([progress])
  await thesisProgressRepository.remove(id)
  await removeLocalUploadFiles(urls)
}

// ─── 管理侧：进度截图 ────────────────────────────────────────

/**
 * 保存进度截图：文件落盘到 UPLOAD_DIR，数据库只存随机文件名对应的访问路径。
 * 注：文件类型 / 大小校验见 P0-4（上传安全校验），将在此函数内补齐。
 */
export async function saveProgressImage(progressId: number, file: MultipartFile): Promise<ThesisProgressImageVo> {
  await ensureProgressExists(progressId)

  const ext = path.extname(file.filename) || '.png'
  const storedName = nanoid(12) + ext
  const uploadDir = resolveUploadDir()
  fs.mkdirSync(uploadDir, { recursive: true })
  const filePath = path.join(uploadDir, storedName)

  await pipeline(file.file, fs.createWriteStream(filePath))

  try {
    return await thesisImageRepository.create({
      progressId,
      filename: file.filename,      // 原始文件名只作展示用
      url: toUploadUrl(storedName), // 对外访问路径用随机文件名
    })
  } catch (err) {
    // 落库失败时清掉刚落盘的文件，避免留下孤儿文件
    await removeLocalUploadFiles([toUploadUrl(storedName)])
    throw err
  }
}

export async function deleteProgressImage(id: number): Promise<void> {
  const image = await thesisImageRepository.findById(id)
  if (!image) throw notFound('截图不存在')
  await thesisImageRepository.remove(id)
  await removeLocalUploadFiles([image.url])
}

// ─── 管理侧：活动 ────────────────────────────────────────────

export async function listActivities(): Promise<ThesisActivityVo[]> {
  const activities = await thesisActivityRepository.list(false)
  return activities.map(toActivityVo)
}

export async function createActivity(input: ActivityCreateInput): Promise<ThesisActivityVo> {
  const activity = await thesisActivityRepository.create({
    title: input.title,
    content: input.content ?? null,
    published: input.published === undefined ? true : input.published,
  })
  return toActivityVo(activity)
}

export async function updateActivity(id: number, input: ActivityUpdateInput): Promise<ThesisActivityVo> {
  const existing = await thesisActivityRepository.findById(id)
  if (!existing) throw notFound('活动不存在')
  const activity = await thesisActivityRepository.update(id, input)
  return toActivityVo(activity)
}

export async function deleteActivity(id: number): Promise<void> {
  const existing = await thesisActivityRepository.findById(id)
  if (!existing) throw notFound('活动不存在')
  await thesisActivityRepository.remove(id)
}

// ─── 管理侧：漂浮字 ──────────────────────────────────────────

export async function getNotice(): Promise<SiteNoticeVo | null> {
  const notice = await siteNoticeRepository.find()
  return notice ? toNoticeVo(notice) : null
}

export async function updateNotice(input: NoticeUpdateInput): Promise<SiteNoticeVo> {
  const notice = await siteNoticeRepository.upsertSingle({
    text: input.text,
    enabled: input.enabled === undefined ? true : input.enabled,
  })
  return toNoticeVo(notice)
}
