// thesis 模块单元测试：只测纯逻辑（DTO 校验 + VO 整形），不依赖数据库。
//
// 这组测试也是本次分层的直接收益：业务规则被抽到 dto / vo 后，
// 不需要起 PostgreSQL 就能验证契约。

import { describe, it, expect } from 'vitest'
import {
  activityUpdateDto,
  noticeUpdateDto,
  progressCreateDto,
  projectCreateDto,
  projectUpdateDto,
  thesisQueryDto,
} from '../../src/modules/thesis/thesis.dto.js'
import {
  toPublicNoticeVo,
  toQueryResultVo,
  toProgressVo,
} from '../../src/modules/thesis/thesis.vo.js'
import { NOT_FOUND_MSG } from '../../src/modules/thesis/thesis.types.js'
import { parseDto } from '../../src/framework/validation.js'
import { HttpError } from '../../src/framework/errors.js'

/** 取第一个校验错误信息 */
function firstError(schema: Parameters<typeof parseDto>[0], input: unknown): string | undefined {
  const parsed = (schema as any).safeParse(input)
  return parsed.success ? undefined : parsed.error.errors[0].message
}

describe('thesis dto：公开查询入参', () => {
  it('题目 + 6 位验证码通过校验', () => {
    const input = parseDto(thesisQueryDto, { title: '  基于 XX 的系统  ', code: '123456' })
    expect(input).toEqual({ title: '基于 XX 的系统', code: '123456' })
  })

  it('验证码位数错误 / 含非数字时，返回统一提示（不暴露具体原因）', () => {
    expect(firstError(thesisQueryDto, { title: '题目', code: '12345' })).toBe(NOT_FOUND_MSG)
    expect(firstError(thesisQueryDto, { title: '题目', code: 'abcdef' })).toBe(NOT_FOUND_MSG)
  })

  it('题目为空时同样返回统一提示', () => {
    expect(firstError(thesisQueryDto, { title: '   ', code: '123456' })).toBe(NOT_FOUND_MSG)
  })
})

describe('thesis dto：进度百分比', () => {
  it('接受数字与数字字符串，并归一成 number', () => {
    expect(parseDto(progressCreateDto, { title: '开题', percent: 30 }).percent).toBe(30)
    expect(parseDto(progressCreateDto, { title: '开题', percent: '80' }).percent).toBe(80)
  })

  it('空值报"不能为空"，不会被 coerce 成 0', () => {
    expect(firstError(progressCreateDto, { title: '开题', percent: '' })).toBe('进度百分比不能为空')
    expect(firstError(progressCreateDto, { title: '开题' })).toBe('进度百分比不能为空')
  })

  it('越界与小数被拒绝（原实现只做 Number() 转换，无范围校验）', () => {
    expect(firstError(progressCreateDto, { title: '开题', percent: -1 })).toBe('进度百分比不能小于 0')
    expect(firstError(progressCreateDto, { title: '开题', percent: 101 })).toBe('进度百分比不能大于 100')
    expect(firstError(progressCreateDto, { title: '开题', percent: 50.5 })).toBe('进度百分比必须是整数')
  })

  it('进度标题不能为空', () => {
    expect(firstError(progressCreateDto, { title: '  ', percent: 10 })).toBe('进度标题不能为空')
  })
})

describe('thesis dto：题目与活动', () => {
  it('创建题目必填项校验 + 去除首尾空格', () => {
    expect(parseDto(projectCreateDto, { title: ' 题目 ', studentName: ' 张三 ' })).toMatchObject({
      title: '题目',
      studentName: '张三',
    })
    expect(firstError(projectCreateDto, { title: '', studentName: '张三' })).toBe('题目不能为空')
    expect(firstError(projectCreateDto, { title: '题目', studentName: '' })).toBe('姓名不能为空')
  })

  it('更新题目允许只传部分字段', () => {
    expect(parseDto(projectUpdateDto, { major: '计算机' })).toEqual({ major: '计算机' })
  })

  it('活动更新允许空对象（不改任何字段）', () => {
    expect(parseDto(activityUpdateDto, {})).toEqual({})
  })

  it('漂浮字未传 text 时回落为空串', () => {
    expect(parseDto(noticeUpdateDto, { enabled: false })).toEqual({ text: '', enabled: false })
  })
})

describe('thesis vo：公开查询结果', () => {
  const project = {
    id: 7,
    uniqueCode: '654321',
    title: '毕设题目',
    studentName: '张三',
    studentNo: null,
    advisor: '李老师',
    major: '软件工程',
  }

  it('不泄露 uniqueCode / 内部 id（验证码即查询凭证）', () => {
    const result = toQueryResultVo(project, [])
    expect(result.project).toEqual({
      title: '毕设题目',
      studentName: '张三',
      studentNo: null,
      advisor: '李老师',
      major: '软件工程',
    })
    expect('uniqueCode' in result.project).toBe(false)
    expect('id' in result.project).toBe(false)
  })

  it('currentPercent 取最近一条进度（入参已按时间倒序）', () => {
    const result = toQueryResultVo(project, [
      { id: 2, title: '中期', percent: 60, content: null, createdAt: new Date('2026-02-01'), images: [] },
      { id: 1, title: '开题', percent: 20, content: '完成开题', createdAt: new Date('2026-01-01'), images: [] },
    ])
    expect(result.currentPercent).toBe(60)
    expect(result.progresses).toHaveLength(2)
  })

  it('无进度时 currentPercent 为 0', () => {
    expect(toQueryResultVo(project, []).currentPercent).toBe(0)
  })

  it('截图只保留 id / url / filename（不带 progressId 等内部字段）', () => {
    const progress = toProgressVo({
      id: 1,
      title: '开题',
      percent: 20,
      content: null,
      createdAt: new Date('2026-01-01'),
      images: [{ id: 9, url: '/uploads/abc.png', filename: '截图.png' } as any],
    })
    expect(progress.images[0]).toEqual({ id: 9, url: '/uploads/abc.png', filename: '截图.png' })
  })
})

describe('thesis vo：站点漂浮字', () => {
  it('未配置时返回空文案且关闭', () => {
    expect(toPublicNoticeVo(null)).toEqual({ text: '', enabled: false })
  })

  it('已配置但关闭时文案为空（前端据此不展示）', () => {
    expect(toPublicNoticeVo({ id: 1, text: '公告', enabled: false })).toEqual({ text: '', enabled: false })
  })

  it('开启时原样返回', () => {
    expect(toPublicNoticeVo({ id: 1, text: '公告', enabled: true })).toEqual({ text: '公告', enabled: true })
  })
})

describe('framework parseDto：校验失败统一抛 400', () => {
  it('抛 HttpError 且状态码 400、错误码 VALIDATION_ERROR', () => {
    try {
      parseDto(thesisQueryDto, { title: '', code: '' })
      throw new Error('应当抛出异常')
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError)
      expect((err as HttpError).statusCode).toBe(400)
      expect((err as HttpError).code).toBe('VALIDATION_ERROR')
      expect((err as HttpError).message).toBe(NOT_FOUND_MSG)
    }
  })
})
