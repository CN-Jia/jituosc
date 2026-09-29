// 邮件发送结果校验的单元测试。
//
// 线上实测背景：Resend SDK v4 把 API 错误放在返回值的 error 字段里、不抛异常，
// 于是「发信失败」被静默当成成功 —— 生产环境对 example.com 实测 Resend 返回 422，
// 而 /api/auth/send-code 返回 200「验证码已发送」，用户永远收不到码。

import { describe, it, expect } from 'vitest'
import { assertSendOk } from '../../src/services/email.service.js'

describe('assertSendOk', () => {
  it('成功结果不抛异常', () => {
    expect(() => assertSendOk({ error: null })).not.toThrow()
    expect(() => assertSendOk({ error: undefined })).not.toThrow()
    expect(() => assertSendOk(null)).not.toThrow()
    expect(() => assertSendOk(undefined)).not.toThrow()
  })

  it('Resend 返回 validation_error 时抛异常（带上原始信息便于排查）', () => {
    expect(() =>
      assertSendOk({ error: { name: 'validation_error', message: 'Invalid `to` field' } }),
    ).toThrow(/Invalid `to` field/)
  })

  it('error 只有 name 时也能抛出可读信息', () => {
    expect(() => assertSendOk({ error: { name: 'rate_limit_exceeded' } })).toThrow(/rate_limit_exceeded/)
  })

  it('error 为空对象时仍按失败处理（宁可报错也不静默）', () => {
    expect(() => assertSendOk({ error: {} })).toThrow(/邮件服务返回错误/)
  })
})
