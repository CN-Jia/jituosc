// thesis 模块出参整形（VO）：决定"哪些字段给哪个调用方看"。
// 与 repository 的 select 白名单配合：repository 负责不多取字段，vo 负责按受众裁剪。

import {
  type PublicSiteNoticeVo,
  type PublicThesisProjectVo,
  type SiteNoticeVo,
  type ThesisActivityVo,
  type ThesisProgressImageVo,
  type ThesisProgressVo,
  type ThesisProjectVo,
  type ThesisQueryResultVo,
} from './thesis.types.js'

/** 管理侧题目列表项（保留验证码与进度计数） */
export function toProjectVo(project: ThesisProjectVo): ThesisProjectVo {
  return {
    id: project.id,
    title: project.title,
    uniqueCode: project.uniqueCode,
    studentName: project.studentName,
    studentNo: project.studentNo,
    advisor: project.advisor,
    major: project.major,
    createdAt: project.createdAt,
    ...(project._count ? { _count: { progresses: project._count.progresses } } : {}),
  }
}

/** 公开查询的题目信息：**不含 uniqueCode**（验证码是查询凭证，绝不能回吐） */
export function toPublicProjectVo(project: {
  title: string
  studentName: string
  studentNo: string | null
  advisor: string | null
  major: string | null
}): PublicThesisProjectVo {
  return {
    title: project.title,
    studentName: project.studentName,
    studentNo: project.studentNo,
    advisor: project.advisor,
    major: project.major,
  }
}

export function toProgressImageVo(image: ThesisProgressImageVo): ThesisProgressImageVo {
  return { id: image.id, url: image.url, filename: image.filename }
}

export function toProgressVo(progress: ThesisProgressVo): ThesisProgressVo {
  return {
    id: progress.id,
    title: progress.title,
    percent: progress.percent,
    content: progress.content,
    createdAt: progress.createdAt,
    images: (progress.images ?? []).map(toProgressImageVo),
  }
}

/** 公开查询结果：currentPercent 取最近一条进度（progresses 已按时间倒序） */
export function toQueryResultVo(
  project: Parameters<typeof toPublicProjectVo>[0],
  progresses: ThesisProgressVo[],
): ThesisQueryResultVo {
  const list = progresses.map(toProgressVo)
  return {
    project: toPublicProjectVo(project),
    currentPercent: list[0]?.percent ?? 0,
    progresses: list,
  }
}

export function toActivityVo(activity: ThesisActivityVo): ThesisActivityVo {
  return {
    id: activity.id,
    title: activity.title,
    content: activity.content,
    published: activity.published,
    createdAt: activity.createdAt,
  }
}

export function toNoticeVo(notice: SiteNoticeVo): SiteNoticeVo {
  return { id: notice.id, text: notice.text, enabled: notice.enabled }
}

/** 公开漂浮字：未配置或已关闭时返回空文案（前端据此不展示） */
export function toPublicNoticeVo(notice: SiteNoticeVo | null): PublicSiteNoticeVo {
  if (!notice) return { text: '', enabled: false }
  return { text: notice.enabled ? notice.text : '', enabled: !!notice.enabled }
}
