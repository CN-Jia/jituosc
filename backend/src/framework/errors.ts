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
export const payloadTooLarge = (message = '文件过大', code: string = ERROR_CODES.FILE_TOO_LARGE) =>
  new HttpError(code, message, 413)

/** 判断一个错误是否为带 code 的 HttpError */
export function isHttpError(err: unknown): err is HttpError {
  return err instanceof HttpError
}

/** HTTP 状态码 → 业务错误码（用于框架/插件抛出的、自带 statusCode 的错误） */
const HTTP_STATUS_TO_CODE: Record<number, string> = {
  400: ERROR_CODES.VALIDATION_ERROR,
  401: ERROR_CODES.UNAUTHORIZED,
  403: ERROR_CODES.FORBIDDEN,
  404: ERROR_CODES.NOT_FOUND,
  409: ERROR_CODES.CONFLICT,
  413: ERROR_CODES.FILE_TOO_LARGE,
  422: ERROR_CODES.VALIDATION_ERROR,
  429: ERROR_CODES.RATE_LIMITED,
}

/** Fastify 框架级错误码 → 对外友好文案（不要把 FST_ERR_xxx 这种内部码透给调用方） */
const FRAMEWORK_ERROR_MESSAGES: Record<string, string> = {
  FST_ERR_CTP_INVALID_JSON_BODY: '请求体不是合法的 JSON',
  FST_ERR_CTP_EMPTY_JSON_BODY: '请求体不能为空',
  FST_ERR_CTP_INVALID_MEDIA_TYPE: '不支持的 Content-Type',
  FST_ERR_CTP_BODY_TOO_LARGE: '请求体过大',
  FST_ERR_VALIDATION: '请求参数不合法',
  FST_ERR_NOT_FOUND: '接口不存在',
}

/**
 * 从任意未知错误提取「可对外返回」的信息。
 * 用于全局错误处理器：业务错误取 code/message，框架错误保留其 4xx，未知错误统一 INTERNAL_ERROR。
 */
export function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err

  const maybe = err as { code?: unknown; message?: string; statusCode?: unknown } | null

  // 框架/插件抛出的 FST_ERR_* 错误（如 JSON 解析失败）自带 4xx 状态码，
  // 必须优先识别：否则会被下面的「大写业务码」分支当成业务码带出去，
  // 调用方会收到 FST_ERR_CTP_INVALID_JSON_BODY 这种内部码（线上旧版本更是直接变成 500）。
  if (maybe && typeof maybe.code === 'string' && maybe.code.startsWith('FST_ERR_')) {
    const status = typeof maybe.statusCode === 'number' && maybe.statusCode >= 400 && maybe.statusCode < 500
      ? maybe.statusCode
      : 400
    const code = HTTP_STATUS_TO_CODE[status] ?? ERROR_CODES.VALIDATION_ERROR
    const message = FRAMEWORK_ERROR_MESSAGES[maybe.code] ?? '请求不合法'
    return new HttpError(code, message, status)
  }

  // 请求体 JSON 解析失败：Fastify 4 会抛一个 SyntaxError（部分版本带 statusCode=400、无 code），
  // 直接透传会把 "Expected property name or '}' in JSON at position 1" 这种内部信息给到调用方。
  if (err instanceof SyntaxError || (maybe && (maybe as { name?: string }).name === 'SyntaxError')) {
    return new HttpError(ERROR_CODES.VALIDATION_ERROR, '请求体不是合法的 JSON', 400)
  }

  // 兼容旧代码里 throw Object.assign(new Error(code), { code, message }) 的写法（大写业务码）
  if (maybe && typeof maybe.code === 'string' && /^[A-Z][A-Z_]+$/.test(maybe.code)) {
    return new HttpError(maybe.code, maybe.message ?? '服务器内部错误', statusForCode(maybe.code))
  }

  // 框架/插件抛出的错误自带 statusCode（如静态服务拒绝路径穿越的 403、multipart 超限的 413）。
  // 必须尊重 4xx：否则会被统一成 500 —— 调用方无法区分「请求有问题」和「服务坏了」，
  // 监控的 5xx 计数也会被这些正常拦截污染。
  const status = maybe?.statusCode
  if (typeof status === 'number' && status >= 400 && status < 500) {
    const code = HTTP_STATUS_TO_CODE[status] ?? ERROR_CODES.VALIDATION_ERROR
    const message = typeof maybe?.message === 'string' && maybe.message
      ? maybe.message.slice(0, 200)
      : '请求被拒绝'
    return new HttpError(code, message, status)
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
    case ERROR_CODES.FILE_TOO_LARGE: return 413
    case ERROR_CODES.FILE_TYPE_INVALID: return 400
    case ERROR_CODES.INTERNAL_ERROR: return 500
    default: return 400
  }
}

export { ErrorCode }
