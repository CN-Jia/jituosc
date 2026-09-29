// thesis 模块数据访问层：封装 ThesisProject / ThesisProgress / ThesisProgressImage /
// ThesisActivity / SiteNotice 的 Prisma 读写。service 不再直接接触 prisma。
//
// 所有查询都用 select 白名单：不把整个模型（含 updatedAt 等无关字段）透给上层。

import { prisma } from '../../lib/prisma.js'
import type {
  SiteNoticeUpsertData,
  SiteNoticeVo,
  ThesisActivityCreateData,
  ThesisActivityVo,
  ThesisProgressCreateData,
  ThesisProgressImageCreateData,
  ThesisProgressImageVo,
  ThesisProgressVo,
  ThesisProjectCreateData,
  ThesisProjectVo,
} from './thesis.types.js'

// ─── 字段白名单 ──────────────────────────────────────────────

const PROJECT_SELECT = {
  id: true,
  title: true,
  uniqueCode: true,
  studentName: true,
  studentNo: true,
  advisor: true,
  major: true,
  createdAt: true,
} as const

const IMAGE_SELECT = { id: true, url: true, filename: true } as const

const PROGRESS_SELECT = {
  id: true,
  title: true,
  percent: true,
  content: true,
  createdAt: true,
  images: { select: IMAGE_SELECT, orderBy: { createdAt: 'asc' as const } },
} as const

const ACTIVITY_SELECT = {
  id: true,
  title: true,
  content: true,
  published: true,
  createdAt: true,
} as const

const NOTICE_SELECT = { id: true, text: true, enabled: true } as const

// ─── 题目 ────────────────────────────────────────────────────

export const thesisProjectRepository = {
  /** 管理侧列表（带各题目的进度条数） */
  list(): Promise<ThesisProjectVo[]> {
    return prisma.thesisProject.findMany({
      orderBy: { createdAt: 'desc' },
      select: { ...PROJECT_SELECT, _count: { select: { progresses: true } } },
    })
  },

  findById(id: number): Promise<ThesisProjectVo | null> {
    return prisma.thesisProject.findUnique({ where: { id }, select: PROJECT_SELECT })
  },

  /** 管理侧详情（带进度与截图） */
  findDetailById(id: number) {
    return prisma.thesisProject.findUnique({
      where: { id },
      select: {
        ...PROJECT_SELECT,
        progresses: { select: PROGRESS_SELECT, orderBy: { createdAt: 'desc' as const } },
      },
    })
  },

  /** 按题目查重（创建前判断是否已存在） */
  findByTitle(title: string) {
    return prisma.thesisProject.findUnique({ where: { title }, select: { id: true } })
  },

  findByUniqueCode(code: string) {
    return prisma.thesisProject.findUnique({ where: { uniqueCode: code }, select: { id: true } })
  },

  /**
   * 公开查询用：按题目取展示字段 + uniqueCode。
   * ⚠️ uniqueCode 仅用于 service 内部校验，绝不可出现在响应里（见 thesis.vo.ts）。
   */
  findByTitleForQuery(title: string) {
    return prisma.thesisProject.findUnique({
      where: { title },
      select: {
        id: true,
        uniqueCode: true,
        title: true,
        studentName: true,
        studentNo: true,
        advisor: true,
        major: true,
      },
    })
  },

  create(data: ThesisProjectCreateData): Promise<ThesisProjectVo> {
    return prisma.thesisProject.create({ data, select: PROJECT_SELECT })
  },

  /** 只更新传入的字段（undefined 由 Prisma 忽略，等价于"未修改"） */
  update(id: number, data: Partial<ThesisProjectCreateData>): Promise<ThesisProjectVo> {
    return prisma.thesisProject.update({ where: { id }, data, select: PROJECT_SELECT })
  },

  async remove(id: number): Promise<void> {
    await prisma.thesisProject.delete({ where: { id } })
  },
}

// ─── 进度 ────────────────────────────────────────────────────

export const thesisProgressRepository = {
  /** 某题目下的全部进度（按创建时间倒序，首条即最新） */
  listByProject(projectId: number): Promise<ThesisProgressVo[]> {
    return prisma.thesisProgress.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: PROGRESS_SELECT,
    })
  },

  findById(id: number): Promise<ThesisProgressVo | null> {
    return prisma.thesisProgress.findUnique({ where: { id }, select: PROGRESS_SELECT })
  },

  create(data: ThesisProgressCreateData): Promise<ThesisProgressVo> {
    return prisma.thesisProgress.create({ data, select: PROGRESS_SELECT })
  },

  async remove(id: number): Promise<void> {
    await prisma.thesisProgress.delete({ where: { id } })
  },
}

// ─── 进度截图 ────────────────────────────────────────────────

export const thesisImageRepository = {
  create(data: ThesisProgressImageCreateData): Promise<ThesisProgressImageVo> {
    return prisma.thesisProgressImage.create({ data, select: IMAGE_SELECT })
  },

  findById(id: number): Promise<ThesisProgressImageVo | null> {
    return prisma.thesisProgressImage.findUnique({ where: { id }, select: IMAGE_SELECT })
  },

  async remove(id: number): Promise<void> {
    await prisma.thesisProgressImage.delete({ where: { id } })
  },
}

// ─── 活动 ────────────────────────────────────────────────────

export const thesisActivityRepository = {
  /** onlyPublished=true 用于公开侧（只返回已发布） */
  list(onlyPublished = false): Promise<ThesisActivityVo[]> {
    return prisma.thesisActivity.findMany({
      where: onlyPublished ? { published: true } : undefined,
      orderBy: { createdAt: 'desc' },
      select: ACTIVITY_SELECT,
    })
  },

  findById(id: number): Promise<ThesisActivityVo | null> {
    return prisma.thesisActivity.findUnique({ where: { id }, select: ACTIVITY_SELECT })
  },

  create(data: ThesisActivityCreateData): Promise<ThesisActivityVo> {
    return prisma.thesisActivity.create({ data, select: ACTIVITY_SELECT })
  },

  update(id: number, data: Partial<ThesisActivityCreateData>): Promise<ThesisActivityVo> {
    return prisma.thesisActivity.update({ where: { id }, data, select: ACTIVITY_SELECT })
  },

  async remove(id: number): Promise<void> {
    await prisma.thesisActivity.delete({ where: { id } })
  },
}

// ─── 站点漂浮字（单例）───────────────────────────────────────

export const siteNoticeRepository = {
  /** 取当前漂浮字配置（表中只应有一条） */
  find(): Promise<SiteNoticeVo | null> {
    return prisma.siteNotice.findFirst({ select: NOTICE_SELECT })
  },

  /** 先改后建：保证单例语义 */
  async upsertSingle(data: SiteNoticeUpsertData): Promise<SiteNoticeVo> {
    const existing = await prisma.siteNotice.findFirst({ select: { id: true } })
    if (existing) {
      return prisma.siteNotice.update({ where: { id: existing.id }, data, select: NOTICE_SELECT })
    }
    return prisma.siteNotice.create({
      data: { text: data.text, enabled: data.enabled ?? true },
      select: NOTICE_SELECT,
    })
  },
}
