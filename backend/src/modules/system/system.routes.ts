// system 模块用户侧路由：认证（注册/登录/验证码/密码/邮箱验证/管理员登录）

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { prisma } from '../../lib/prisma.js'
import { adminLogin } from './system.service.js'
import { sendVerifyCode } from '../../services/email.service.js'
import { successResponse, errorResponse, ERROR_CODES } from '../../framework/response.js'
import { verifyJWT } from '../../middlewares/auth.middleware.js'
import { env } from '../../config/env.js'
import { generateInviteCode, awardPoints } from '../points/points.service.js'

export async function authRoutes(fastify: FastifyInstance) {
  // ── 发送邮箱验证码 ────────────────────────────────────────────
  fastify.post('/auth/send-code', async (request, reply) => {
    const schema = z.object({ email: z.string().email() })
    const parse = schema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '邮箱格式不正确'))

    const { email } = parse.data

    const recent = await prisma.emailVerification.findFirst({
      where: { email, usedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    if (recent && Date.now() - recent.createdAt.getTime() < 60_000) {
      return reply.code(429).send(errorResponse(ERROR_CODES.RATE_LIMITED, '请等待60秒后再次发送'))
    }

    const code = String(crypto.randomInt(100000, 999999))
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    await prisma.emailVerification.create({ data: { email, code, expiresAt } })

    try {
      await sendVerifyCode(email, code)
    } catch {
      return reply.code(500).send(errorResponse(ERROR_CODES.INTERNAL_ERROR, '邮件发送失败，请稍后重试'))
    }

    return reply.send(successResponse({ message: '验证码已发送' }))
  })

  // ── 注册 ─────────────────────────────────────────────────────
  fastify.post('/auth/register', async (request, reply) => {
    const schema = z.object({
      username: z.string().min(4).max(20).regex(/^[a-zA-Z0-9_]+$/, '用户名只能含字母数字下划线'),
      nickname: z.string().min(2).max(20),
      email: z.string().email(),
      password: z.string().min(8).regex(/(?=.*[a-zA-Z])(?=.*[0-9])/, '密码需包含字母和数字'),
      phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
      wechatId: z.string().min(1),
      grade: z.enum(['FRESHMAN', 'SOPHOMORE', 'JUNIOR']),
      code: z.string().length(6),
      ref: z.string().optional(),
    })

    const parse = schema.safeParse(request.body)
    if (!parse.success) {
      const msg = parse.error.errors[0]?.message ?? '参数错误'
      return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, msg))
    }

    const { username, nickname, email, password, phone, wechatId, grade, code, ref } = parse.data

    const verification = await prisma.emailVerification.findFirst({
      where: { email, code, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    if (!verification) {
      return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '验证码无效或已过期'))
    }

    const [existUser, existEmail] = await Promise.all([
      prisma.user.findUnique({ where: { username } }),
      prisma.user.findUnique({ where: { email } }),
    ])
    if (existUser) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '用户名已被使用'))
    if (existEmail) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '邮箱已被注册'))

    const passwordHash = await bcrypt.hash(password, 10)
    const inviteCode = await generateInviteCode()

    let invitedById: string | undefined
    if (ref) {
      const inviter = await prisma.user.findUnique({ where: { inviteCode: ref } })
      if (inviter && inviter.username !== username) {
        invitedById = inviter.id
      }
    }

    const user = await prisma.user.create({
      data: {
        username, nickname, email, emailVerified: true,
        passwordHash, phone, wechatId, grade,
        inviteCode,
        ...(invitedById ? { invitedById } : {}),
      },
    })

    await prisma.emailVerification.update({ where: { id: verification.id }, data: { usedAt: new Date() } })

    if (invitedById) {
      awardPoints(invitedById, 'INVITE_REGISTER', user.id, `邀请用户「${user.nickname}」注册`).catch(() => {})
    }

    const token = fastify.jwt.sign({ userId: user.id, role: 'user' }, { expiresIn: env.JWT_EXPIRES_IN })
    return reply.send(successResponse({ token, userId: user.id, nickname: user.nickname }))
  })

  // ── 登录 ─────────────────────────────────────────────────────
  fastify.post('/auth/login', async (request, reply) => {
    const schema = z.object({
      identifier: z.string().min(1),
      password: z.string().min(1),
    })

    const parse = schema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '参数错误'))

    const { identifier, password } = parse.data

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
        isActive: true,
      },
    })

    if (!user) return reply.code(401).send(errorResponse(ERROR_CODES.UNAUTHORIZED, '账号或密码错误'))

    if (user.lockUntil && user.lockUntil > new Date()) {
      const seconds = Math.ceil((user.lockUntil.getTime() - Date.now()) / 1000)
      return reply.code(401).send(errorResponse(ERROR_CODES.UNAUTHORIZED, `账号已锁定，请 ${seconds} 秒后重试`))
    }

    const valid = await bcrypt.compare(password, user.passwordHash)

    if (!valid) {
      const attempts = user.loginAttempts + 1
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 5 * 60 * 1000) : null
      await prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: attempts, ...(lockUntil ? { lockUntil } : {}) },
      })
      const remaining = Math.max(0, 5 - attempts)
      return reply.code(401).send(errorResponse(ERROR_CODES.UNAUTHORIZED,
        remaining > 0 ? `密码错误，还剩 ${remaining} 次机会` : '账号已锁定5分钟',
      ))
    }

    await prisma.user.update({ where: { id: user.id }, data: { loginAttempts: 0, lockUntil: null } })

    const token = fastify.jwt.sign({ userId: user.id, role: 'user' }, { expiresIn: env.JWT_EXPIRES_IN })
    return reply.send(successResponse({
      token, userId: user.id, nickname: user.nickname,
      username: user.username, email: user.email,
    }))
  })

  // ── 获取当前用户信息 ─────────────────────────────────────────
  fastify.get('/auth/me', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, nickname: true, email: true, phone: true, wechatId: true, grade: true, emailVerified: true, createdAt: true },
    })
    if (!user) return reply.code(404).send(errorResponse(ERROR_CODES.UNAUTHORIZED, '用户不存在'))
    return reply.send(successResponse(user))
  })

  // ── 更新个人资料 ─────────────────────────────────────────────
  fastify.put('/auth/profile', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const schema = z.object({
      nickname: z.string().min(2).max(20).optional(),
      phone: z.string().regex(/^1[3-9]\d{9}$/).optional(),
      wechatId: z.string().min(1).optional(),
      grade: z.enum(['FRESHMAN', 'SOPHOMORE', 'JUNIOR']).optional(),
    })
    const parse = schema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '参数错误'))

    const user = await prisma.user.update({ where: { id: userId }, data: parse.data })
    return reply.send(successResponse({ nickname: user.nickname, phone: user.phone, wechatId: user.wechatId, grade: user.grade }))
  })

  // ── 修改密码 ─────────────────────────────────────────────────
  fastify.put('/auth/password', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const schema = z.object({
      oldPassword: z.string().min(1),
      newPassword: z.string().min(8).regex(/(?=.*[a-zA-Z])(?=.*[0-9])/, '密码需包含字母和数字'),
    })
    const parse = schema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, parse.error.errors[0]?.message ?? '参数错误'))

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return reply.code(404).send(errorResponse(ERROR_CODES.UNAUTHORIZED, '用户不存在'))

    const valid = await bcrypt.compare(parse.data.oldPassword, user.passwordHash)
    if (!valid) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '旧密码不正确'))

    const passwordHash = await bcrypt.hash(parse.data.newPassword, 10)
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } })

    return reply.send(successResponse({ message: '密码修改成功' }))
  })

  // ── 忘记密码：发送重置验证码 ─────────────────────────────────
  fastify.post('/auth/forgot-password', async (request, reply) => {
    const schema = z.object({ email: z.string().email() })
    const parse = schema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '邮箱格式不正确'))

    const { email } = parse.data

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return reply.send(successResponse({ message: '如果该邮箱已注册，验证码将发送到您的邮箱' }))

    const recent = await prisma.emailVerification.findFirst({
      where: { email, usedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    if (recent && Date.now() - recent.createdAt.getTime() < 60_000) {
      return reply.code(429).send(errorResponse(ERROR_CODES.RATE_LIMITED, '请等待60秒后再次发送'))
    }

    const code = String(crypto.randomInt(100000, 999999))
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await prisma.emailVerification.create({ data: { email, code, expiresAt } })

    try {
      await sendVerifyCode(email, code)
    } catch {
      return reply.code(500).send(errorResponse(ERROR_CODES.INTERNAL_ERROR, '邮件发送失败，请稍后重试'))
    }

    return reply.send(successResponse({ message: '如果该邮箱已注册，验证码将发送到您的邮箱' }))
  })

  // ── 忘记密码：重置密码 ─────────────────────────────────────
  fastify.post('/auth/reset-password', async (request, reply) => {
    const schema = z.object({
      email: z.string().email(),
      code: z.string().length(6),
      newPassword: z.string().min(8).regex(/(?=.*[a-zA-Z])(?=.*[0-9])/, '密码需包含字母和数字'),
    })
    const parse = schema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, parse.error.errors[0]?.message ?? '参数错误'))

    const { email, code, newPassword } = parse.data

    const verification = await prisma.emailVerification.findFirst({
      where: { email, code, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    if (!verification) {
      return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '验证码无效或已过期'))
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '该邮箱未注册'))

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, loginAttempts: 0, lockUntil: null },
    })
    await prisma.emailVerification.update({ where: { id: verification.id }, data: { usedAt: new Date() } })

    return reply.send(successResponse({ message: '密码重置成功，请使用新密码登录' }))
  })

  // ── 重新发送邮箱验证（已登录用户）────────────────────────────
  fastify.post('/auth/resend-verification', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return reply.code(404).send(errorResponse(ERROR_CODES.UNAUTHORIZED, '用户不存在'))
    if (user.emailVerified) return reply.send(successResponse({ message: '邮箱已验证' }))

    const email = user.email

    const recent = await prisma.emailVerification.findFirst({
      where: { email, usedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    if (recent && Date.now() - recent.createdAt.getTime() < 60_000) {
      return reply.code(429).send(errorResponse(ERROR_CODES.RATE_LIMITED, '请等待60秒后再次发送'))
    }

    const code = String(crypto.randomInt(100000, 999999))
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
    await prisma.emailVerification.create({ data: { email, code, expiresAt } })

    try {
      await sendVerifyCode(email, code)
    } catch {
      return reply.code(500).send(errorResponse(ERROR_CODES.INTERNAL_ERROR, '邮件发送失败，请稍后重试'))
    }

    return reply.send(successResponse({ message: '验证码已发送' }))
  })

  // ── 验证邮箱（已登录用户输入验证码）──────────────────────────
  fastify.post('/auth/verify-email', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const schema = z.object({ code: z.string().length(6) })
    const parse = schema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '验证码格式不正确'))

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return reply.code(404).send(errorResponse(ERROR_CODES.UNAUTHORIZED, '用户不存在'))
    if (user.emailVerified) return reply.send(successResponse({ message: '邮箱已验证' }))

    const verification = await prisma.emailVerification.findFirst({
      where: { email: user.email, code: parse.data.code, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    if (!verification) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '验证码无效或已过期'))

    await prisma.user.update({ where: { id: userId }, data: { emailVerified: true } })
    await prisma.emailVerification.update({ where: { id: verification.id }, data: { usedAt: new Date() } })

    return reply.send(successResponse({ message: '邮箱验证成功' }))
  })

  // ── 管理员登录（带速率限制）─────────────────────────────────
  const adminLoginAttempts = new Map<string, { count: number; resetAt: number }>()
  const ADMIN_WINDOW_MS = 15 * 60_000
  const ADMIN_MAX_ATTEMPTS = 5

  const adminLoginSchema = z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(200) })

  fastify.post('/auth/admin-login', async (request, reply) => {
    const ip = request.ip
    const now = Date.now()
    const entry = adminLoginAttempts.get(ip)

    if (entry && now < entry.resetAt && entry.count >= ADMIN_MAX_ATTEMPTS) {
      const seconds = Math.ceil((entry.resetAt - now) / 1000)
      return reply.code(429).send(errorResponse(ERROR_CODES.RATE_LIMITED, `登录尝试过多，请 ${seconds} 秒后重试`))
    }

    const parse = adminLoginSchema.safeParse(request.body)
    if (!parse.success) return reply.code(400).send(errorResponse(ERROR_CODES.VALIDATION_ERROR, '参数错误'))
    const { username, password } = parse.data
    const ok = await adminLogin(username, password)

    if (!ok) {
      const attempts = (entry && now < entry.resetAt) ? entry.count + 1 : 1
      adminLoginAttempts.set(ip, { count: attempts, resetAt: now + ADMIN_WINDOW_MS })
      return reply.code(401).send(errorResponse(ERROR_CODES.UNAUTHORIZED, '用户名或密码错误'))
    }

    adminLoginAttempts.delete(ip)
    const token = fastify.jwt.sign({ role: 'admin' }, { expiresIn: env.JWT_EXPIRES_IN })
    return reply.send(successResponse({ token }))
  })

  // 定期清理过期的管理员登录计数
  setInterval(() => {
    const now = Date.now()
    for (const [ip, entry] of adminLoginAttempts) {
      if (now > entry.resetAt) adminLoginAttempts.delete(ip)
    }
  }, 5 * 60_000)
}
