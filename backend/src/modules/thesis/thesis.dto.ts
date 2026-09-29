// thesis 模块入参校验（Zod DTO）。
// 路由层不再出现 `req.body as any`：一律经 parseDto 校验后转成强类型对象。

import { z } from 'zod'
import { NOT_FOUND_MSG } from './thesis.types.js'

/** 路径参数 :id（字符串 → 正整数） */
export const idParamDto = z.object({
  id: z.coerce.number().int().positive('无效的 ID'),
})

// ─── 题目 ────────────────────────────────────────────────────

export const projectCreateDto = z.object({
  title: z.string({ required_error: '题目不能为空' }).trim().min(1, '题目不能为空').max(200, '题目过长（最多 200 字）'),
  studentName: z.string({ required_error: '姓名不能为空' }).trim().min(1, '姓名不能为空').max(50, '姓名过长（最多 50 字）'),
  studentNo: z.string().trim().max(50, '学号过长').nullish(),
  advisor: z.string().trim().max(50, '指导老师过长').nullish(),
  major: z.string().trim().max(100, '专业过长').nullish(),
})

/** 更新：字段全部可选，未传的字段 Prisma 会忽略（不会清空） */
export const projectUpdateDto = projectCreateDto.partial()

// ─── 进度 ────────────────────────────────────────────────────

// 百分比：兼容表单传来的字符串；空值报"不能为空"而不是被 coerce 成 0
const percentField = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v),
  z
    .number({ invalid_type_error: '进度百分比不能为空', required_error: '进度百分比不能为空' })
    .int('进度百分比必须是整数')
    .min(0, '进度百分比不能小于 0')
    .max(100, '进度百分比不能大于 100'),
)

export const progressCreateDto = z.object({
  title: z.string({ required_error: '进度标题不能为空' }).trim().min(1, '进度标题不能为空').max(200, '进度标题过长'),
  percent: percentField,
  content: z.string().max(5000, '进度说明过长（最多 5000 字）').nullish(),
})

// ─── 活动 ────────────────────────────────────────────────────

export const activityCreateDto = z.object({
  title: z.string({ required_error: '活动标题不能为空' }).trim().min(1, '活动标题不能为空').max(200, '活动标题过长'),
  content: z.string().max(10000, '活动内容过长').nullish(),
  published: z.boolean().optional(),
})

export const activityUpdateDto = activityCreateDto.partial()

// ─── 漂浮字 ──────────────────────────────────────────────────

export const noticeUpdateDto = z.object({
  text: z.string().max(200, '公告文字过长（最多 200 字）').default(''),
  enabled: z.boolean().optional(),
})

// ─── 公开查询 ────────────────────────────────────────────────
// 校验失败也返回统一的 NOT_FOUND_MSG：对外不区分"参数不对"与"题目/验证码不对"
export const thesisQueryDto = z.object({
  title: z.string({ required_error: NOT_FOUND_MSG }).trim().min(1, NOT_FOUND_MSG).max(200, NOT_FOUND_MSG),
  code: z.string({ required_error: NOT_FOUND_MSG }).trim().regex(/^\d{6}$/, NOT_FOUND_MSG),
})

export type ProjectCreateInput = z.infer<typeof projectCreateDto>
export type ProjectUpdateInput = z.infer<typeof projectUpdateDto>
export type ProgressCreateInput = z.infer<typeof progressCreateDto>
export type ActivityCreateInput = z.infer<typeof activityCreateDto>
export type ActivityUpdateInput = z.infer<typeof activityUpdateDto>
export type NoticeUpdateInput = z.infer<typeof noticeUpdateDto>
export type ThesisQueryInput = z.infer<typeof thesisQueryDto>
