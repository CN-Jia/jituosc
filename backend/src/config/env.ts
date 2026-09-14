import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // 邮件（Resend）
  RESEND_API_KEY: z.string().default(''),
  MAIL_FROM: z.string().default('noreply@jituo.cc.cd'),

  // Server酱推送（可选）
  SERVERCHAN_TOKEN: z.string().default(''),

  // 管理员账号
  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD_HASH: z.string().min(1),

  // 管理员微信号（展示给用户）
  ADMIN_WECHAT_ID: z.string().default('Jt--04'),

  APP_BASE_URL: z.string().default('http://localhost:3000'),

  // Prometheus（可选，监控面板用）
  PROMETHEUS_URL: z.string().default('http://localhost:9090'),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
  console.error('❌ Invalid environment variables:')
  console.error(result.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = result.data
