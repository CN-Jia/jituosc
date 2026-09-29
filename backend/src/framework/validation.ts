// DTO 校验助手：把 Zod 校验失败统一转成框架的 HttpError(400 / VALIDATION_ERROR)，
// 交由全局 setErrorHandler 输出统一的 { success:false, error:{ code, message } }。
//
// 放在 framework 层而不是某个模块内：任何模块的 dto 都可以直接复用。

import { ZodTypeAny, z } from 'zod'
import { badRequest } from './errors.js'

/** 校验入参；失败时抛 HttpError（400），成功时返回推断出的类型 */
export function parseDto<T extends ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.errors[0]
    throw badRequest(first?.message ?? '参数错误')
  }
  return parsed.data
}
