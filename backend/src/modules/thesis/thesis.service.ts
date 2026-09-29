// thesis 模块业务逻辑：毕设进度查询、验证码生成

import { randomInt } from 'node:crypto'
import { prisma } from '../../lib/prisma.js'

const NOT_FOUND_MSG = '请核实是否是自己的题目，如果遇到问题联系管理员Jt--04'

export { NOT_FOUND_MSG }

/** 生成 6 位唯一验证码 */
export async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const code = randomInt(100000, 1000000).toString()
    const existing = await prisma.thesisProject.findUnique({ where: { uniqueCode: code } })
    if (!existing) return code
  }
  throw new Error('生成唯一验证码失败')
}

/** 按题目 + 6 位验证码查询毕设进度（找不到返回 null） */
export async function queryProjectProgress(title: string, code: string) {
  const project = await prisma.thesisProject.findUnique({ where: { title } })
  if (!project || project.uniqueCode !== code) return null

  const progresses = await prisma.thesisProgress.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'desc' },
    include: { images: { orderBy: { createdAt: 'asc' } } },
  })

  return {
    project: {
      title: project.title,
      studentName: project.studentName,
      studentNo: project.studentNo,
      advisor: project.advisor,
      major: project.major,
    },
    currentPercent: progresses[0]?.percent ?? 0,
    progresses,
  }
}
