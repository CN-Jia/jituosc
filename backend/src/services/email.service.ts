import { Resend } from 'resend'
import { env } from '../config/env.js'

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

/** 发送邮箱验证码 */
export async function sendVerifyCode(email: string, code: string): Promise<void> {
  if (!resend) {
    // 开发模式：控制台打印验证码
    console.log(`[DEV] 验证码 → ${email}: ${code}`)
    return
  }

  await resend.emails.send({
    from: env.MAIL_FROM,
    to: email,
    subject: '【极拓空间】邮箱验证码',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e8edf2">
        <h2 style="color:#1677ff;margin-bottom:8px">极拓空间 邮箱验证</h2>
        <p style="color:#666;margin-bottom:24px">您正在注册 极拓空间 账号，请使用以下验证码完成验证：</p>
        <div style="background:#f0f6ff;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
          <span style="font-size:36px;font-weight:bold;letter-spacing:12px;color:#1677ff">${code}</span>
        </div>
        <p style="color:#999;font-size:13px">验证码 5 分钟内有效，请勿泄露给他人。</p>
        <p style="color:#ccc;font-size:12px;margin-top:16px">如非本人操作，请忽略此邮件。</p>
      </div>
    `,
  })
}

/** 发送密码重置验证码 */
export async function sendResetCode(email: string, code: string): Promise<void> {
  if (!resend) {
    console.log(`[DEV] 密码重置验证码 → ${email}: ${code}`)
    return
  }

  await resend.emails.send({
    from: env.MAIL_FROM,
    to: email,
    subject: '【极拓空间】密码重置验证码',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e8edf2">
        <h2 style="color:#1677ff;margin-bottom:8px">极拓空间 密码重置</h2>
        <p style="color:#666;margin-bottom:24px">您正在重置密码，请使用以下验证码完成验证：</p>
        <div style="background:#f0f6ff;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
          <span style="font-size:36px;font-weight:bold;letter-spacing:12px;color:#1677ff">${code}</span>
        </div>
        <p style="color:#999;font-size:13px">验证码 10 分钟内有效，请勿泄露给他人。</p>
        <p style="color:#ccc;font-size:12px;margin-top:16px">如非本人操作，请忽略此邮件。</p>
      </div>
    `,
  })
}

/** 发送管理员回复反馈通知 */
export async function sendFeedbackReply(email: string, title: string, reply: string): Promise<void> {
  if (!resend) {
    console.log(`[DEV] 反馈回复通知 → ${email}`)
    return
  }

  await resend.emails.send({
    from: env.MAIL_FROM,
    to: email,
    subject: '【极拓空间】您的反馈已收到回复',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e8edf2">
        <h2 style="color:#1677ff;margin-bottom:8px">您的反馈已回复</h2>
        <p style="color:#666">您提交的反馈「${title}」已收到管理员回复：</p>
        <div style="background:#f7f8fc;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #1677ff">
          <p style="color:#333;margin:0">${reply}</p>
        </div>
        <p style="color:#999;font-size:13px">登录 极拓空间 查看完整详情。</p>
      </div>
    `,
  })
}
