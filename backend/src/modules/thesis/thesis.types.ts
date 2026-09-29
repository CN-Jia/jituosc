// thesis 模块共享类型与常量。
// 只放类型/常量，不引入任何依赖，供 dto / vo / repository / service 共用，避免循环引用。

/** 公开查询失败时的统一提示（刻意不区分"题目不存在"与"验证码错误"，避免被枚举） */
export const NOT_FOUND_MSG = '请核实是否是自己的题目，如果遇到问题联系管理员Jt--04'

// ─── 出参（VO）────────────────────────────────────────────────

/** 题目（管理侧视图：含查询验证码） */
export interface ThesisProjectVo {
  id: number
  title: string
  uniqueCode: string
  studentName: string
  studentNo: string | null
  advisor: string | null
  major: string | null
  createdAt: Date
  /** 列表页附带各题目的进度条数 */
  _count?: { progresses: number }
}

/** 题目（公开查询视图：刻意不含 uniqueCode —— 它就是查询凭证） */
export interface PublicThesisProjectVo {
  title: string
  studentName: string
  studentNo: string | null
  advisor: string | null
  major: string | null
}

export interface ThesisProgressImageVo {
  id: number
  url: string
  filename: string
}

export interface ThesisProgressVo {
  id: number
  title: string
  percent: number
  content: string | null
  createdAt: Date
  images: ThesisProgressImageVo[]
}

/** 公开查询结果：题目信息 + 当前进度百分比 + 全部进度记录 */
export interface ThesisQueryResultVo {
  project: PublicThesisProjectVo
  currentPercent: number
  progresses: ThesisProgressVo[]
}

export interface ThesisActivityVo {
  id: number
  title: string
  content: string | null
  published: boolean
  createdAt: Date
}

export interface SiteNoticeVo {
  id: number
  text: string
  enabled: boolean
}

/** 公开漂浮字（站点未配置或已关闭时返回空文案） */
export interface PublicSiteNoticeVo {
  text: string
  enabled: boolean
}

// ─── 入参（由 dto 推断，这里只声明仓储层需要的落库结构）────────

export interface ThesisProjectCreateData {
  title: string
  uniqueCode: string
  studentName: string
  studentNo?: string | null
  advisor?: string | null
  major?: string | null
}

export interface ThesisProgressCreateData {
  projectId: number
  title: string
  percent: number
  content?: string | null
}

export interface ThesisProgressImageCreateData {
  progressId: number
  filename: string
  url: string
}

export interface ThesisActivityCreateData {
  title: string
  content?: string | null
  published?: boolean
}

export interface SiteNoticeUpsertData {
  text: string
  enabled?: boolean
}
