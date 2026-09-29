// toHttpError 的单元测试：这是「客户端错误不能被记成服务端故障」的最后一道防线。
//
// 线上实测背景：POST /api/orders 传坏 JSON 时返回 500 INTERNAL_ERROR（应为 400）。

import { describe, it, expect } from 'vitest'
import { HttpError, toHttpError, badRequest, notFound } from '../../src/framework/errors.js'
import { ERROR_CODES } from '../../src/framework/response.js'

/** 造一个 Fastify 风格的框架错误 */
function fastifyError(code: string, message: string, statusCode: number) {
  return Object.assign(new Error(message), { code, statusCode })
}

describe('toHttpError', () => {
  it('业务 HttpError 原样返回', () => {
    const err = badRequest('参数不对')
    expect(toHttpError(err)).toBe(err)
    expect(toHttpError(notFound('订单不存在')).statusCode).toBe(404)
  })

  it('请求体不是合法 JSON → 400 VALIDATION_ERROR（而不是 500）', () => {
    const err = fastifyError('FST_ERR_CTP_INVALID_JSON_BODY', 'Body is not valid JSON', 400)
    const http = toHttpError(err)
    expect(http.statusCode).toBe(400)
    expect(http.code).toBe(ERROR_CODES.VALIDATION_ERROR)
    expect(http.message).toBe('请求体不是合法的 JSON')
    // 不能把框架内部错误码透给调用方
    expect(http.code).not.toContain('FST_ERR')
    expect(http.message).not.toContain('FST_ERR')
  })

  it('其它框架级错误也给出友好文案', () => {
    expect(toHttpError(fastifyError('FST_ERR_CTP_EMPTY_JSON_BODY', 'x', 400)).message).toBe('请求体不能为空')
    expect(toHttpError(fastifyError('FST_ERR_CTP_INVALID_MEDIA_TYPE', 'x', 415)).statusCode).toBe(415)
    expect(toHttpError(fastifyError('FST_ERR_CTP_BODY_TOO_LARGE', 'x', 413)).code).toBe(ERROR_CODES.FILE_TOO_LARGE)
  })

  it('JSON 语法错误（SyntaxError，Fastify 4 实测这条路径不带 FST 码）→ 400 且不透传内部信息', () => {
    const raw = new SyntaxError("Expected property name or '}' in JSON at position 1 (line 1 column 2)")
    const http = toHttpError(raw)
    expect(http.statusCode).toBe(400)
    expect(http.code).toBe(ERROR_CODES.VALIDATION_ERROR)
    expect(http.message).toBe('请求体不是合法的 JSON')
    expect(http.message).not.toContain('position')
  })

  it('框架错误缺 statusCode 时兜底为 400', () => {
    const http = toHttpError({ code: 'FST_ERR_VALIDATION', message: 'bad' })
    expect(http.statusCode).toBe(400)
    expect(http.message).toBe('请求参数不合法')
  })

  it('未知错误统一 500 INTERNAL_ERROR，不泄露原始信息', () => {
    const http = toHttpError(new Error('数据库连接串 postgresql://u:p@host/db 挂了'))
    expect(http.statusCode).toBe(500)
    expect(http.code).toBe(ERROR_CODES.INTERNAL_ERROR)
    expect(http.message).toBe('服务器内部错误')
  })

  it('旧式大写业务码仍按业务错误处理', () => {
    const http = toHttpError({ code: 'ORDER_NOT_FOUND', message: '订单不存在' })
    expect(http.statusCode).toBe(404)
    expect(http.code).toBe('ORDER_NOT_FOUND')
  })

  it('HttpError 实例带 code/statusCode 字段', () => {
    const err = new HttpError('CUSTOM', 'x', 418)
    expect(err).toMatchObject({ code: 'CUSTOM', statusCode: 418, name: 'HttpError' })
  })
})
