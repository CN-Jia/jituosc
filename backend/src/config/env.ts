import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // 邮件（Resend）
  RESEND_API_KEY: z.string().default(''),
  MAIL_FROM: z.string().default('noreply@jituo.online'),

  // Server酱推送（可选）
  SERVERCHAN_TOKEN: z.string().default(''),

  // 管理员账号
  ADMIN_USERNAME: z.string().min(1),
  /**
   * 管理员密码的 bcrypt 哈希（60 字符）。
   *
   * ⚠️ 两个真实的坑，都在这里兜住：
   * 1) Docker Compose 会对 env_file 的值做变量插值：哈希形如 $2b$10$xxxx，
   *    其中 $xxxx 会被当作变量替换成空串 → 哈希被静默截断成 "$2b$10"，
   *    表现为"服务正常启动、管理员永远登不上"。compose 路径下必须写成 $$2b$$10$$xxxx。
   *    这里统一把 $$ 还原成 $，让同一份 .env 在 compose（会插值）与 PM2/dotenv（不会插值）
   *    两条路径下都能用 —— bcrypt 哈希只含 ./A-Za-z0-9，不会出现 $$，还原无歧义。
   * 2) 格式非法时直接启动失败，而不是留下一个能跑却登不进后台的服务。
   */
  ADMIN_PASSWORD_HASH: z
    .string()
    .min(1)
    .transform((v) => v.replace(/\$\$/g, '$'))
    .refine((v) => /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(v), {
      message:
        '不是合法的 bcrypt 哈希（应为 60 字符、形如 $2b$10$...）。' +
        '生成：node -e "require(\'bcrypt\').hash(\'你的密码\',10).then(console.log)"。' +
        '若通过 Docker Compose 部署，.env 中哈希的每个 $ 都要写成 $$（compose 会做变量插值，否则会被截断）',
    }),

  // 管理员微信号（展示给用户）
  ADMIN_WECHAT_ID: z.string().default('Jt--04'),

  APP_BASE_URL: z.string().default('http://localhost:3000'),

  // 本地上传目录（相对路径按进程工作目录解析；容器内为 /app/backend/uploads）
  UPLOAD_DIR: z.string().default('uploads'),

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
