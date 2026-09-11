// 向后兼容 re-export：旧代码继续可用，新代码统一从 framework 导入。
export { successResponse, errorResponse, ERROR_CODES } from '../framework/response.js'
export type { ErrorCode } from '../framework/response.js'
