// 统一业务错误：携带错误码 + HTTP 状态码，供全局 setErrorHandler 识别。
// 借鉴芋道 ServiceException + 全局异常处理器思路。

import { ERROR_CODES, ErrorCode } from './response.js'

export class HttpError extends Error {
  readonly code: string
  readonly statusCode: number

  constructor(code: string, message: string, statusCode = 400) {
    super(message)
    this.name = 'HttpError'
    this.code = code
    this.statusCode = statusCode
  }
}

/** 便捷工厂 */
export const badRequest = (message = '参数错误', code: string = ERROR_CODES.VALIDATION_ERROR) =>
  new HttpError(code, message, 400)
export const unauthorized = (message = '请先登录') =>
  new HttpError(ERROR_CODES.UNAUTHORIZED, message, 401)
export const forbidden = (message = '无权限') =>
  new HttpError(ERROR_CODES.FORBIDDEN, message, 403)
export const notFound = (message = '资源不存在', code: string = ERROR_CODES.NOT_FOUND) =>
  new HttpError(code, message, 404)
export const conflict = (message = '资源冲突', code: string = ERROR_CODES.CONFLICT) =>
  new HttpError(code, message, 409)
export const unprocessable = (message: string, code: string) =>
  new HttpError(code, message, 422)

/** 判断一个错误是否为带 code 的 HttpError */
export function isHttpError(err: unknown): err is HttpError {
  return err instanceof HttpError
}

/**
 * 从任意未知错误提取「可对外返回」的信息。
 * 用于全局错误处理器：业务错误取 code/message，未知错误统一 INTERNAL_ERROR。
 */
export function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err

  // 兼容旧代码里 throw Object.assign(new Error(code), { code, message }) 的写法（大写业务码）
  const maybe = err as { code?: unknown; message?: string } | null
  if (maybe && typeof maybe.code === 'string' && /^[A-Z][A-Z_]+$/.test(maybe.code)) {
    return new HttpError(maybe.code, maybe.message ?? '服务器内部错误', statusForCode(maybe.code))
  }

  return new HttpError(ERROR_CODES.INTERNAL_ERROR, '服务器内部错误', 500)
}

/** 依据错误码推断 HTTP 状态码（兜底映射） */
export function statusForCode(code: string): number {
  switch (code) {
    case ERROR_CODES.UNAUTHORIZED: return 401
    case ERROR_CODES.FORBIDDEN: return 403
    case ERROR_CODES.NOT_FOUND:
    case ERROR_CODES.ORDER_NOT_FOUND:
    case ERROR_CODES.PRODUCT_NOT_FOUND: return 404
    case ERROR_CODES.INVALID_STATUS_TRANSITION: return 422
    case ERROR_CODES.CONFLICT: return 409
    case ERROR_CODES.RATE_LIMITED: return 429
    case ERROR_CODES.INTERNAL_ERROR: return 500
    default: return 400
  }
}

export { ErrorCode }
