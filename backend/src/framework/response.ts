// 统一 API 响应格式 + 错误码枚举（framework 层权威实现）

export function successResponse<T>(data: T) {
  return { success: true as const, data }
}

export function errorResponse(code: string, message: string, _statusCode?: number) {
  return { success: false as const, error: { code, message } }
}

/** 业务错误码枚举（借鉴芋道「错误码 + 全局异常」规范，集中管理） */
export const ERROR_CODES = {
  // 通用
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  CONFLICT: 'CONFLICT',
  // 订单
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ORDER_MISMATCH: 'ORDER_MISMATCH',
  DUPLICATE_WARNING: 'DUPLICATE_WARNING',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  // 商品/交易
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  ORDER_STATUS_INVALID: 'ORDER_STATUS_INVALID',
  // 优惠券
  COUPON_INVALID: 'COUPON_INVALID',
  COUPON_EXPIRED: 'COUPON_EXPIRED',
  COUPON_USED_UP: 'COUPON_USED_UP',
  // 积分
  INSUFFICIENT_POINTS: 'INSUFFICIENT_POINTS',
  // 文件/其它
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  LINK_EXPIRED: 'LINK_EXPIRED',
  INVALID_DATE: 'INVALID_DATE',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]
