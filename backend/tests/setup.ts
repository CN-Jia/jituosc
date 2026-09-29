// 测试环境兜底变量：仅为让 config/env.ts 的 Zod 校验通过。
//
// CI 的测试 job 已经注入了这些变量，这里只在缺失时兜底，
// 这样本地直接 `pnpm test` 不必先准备 .env。
// 注意：必须在任何 import 了 config/env.js 的模块之前执行（vitest setupFiles 保证）。

process.env.NODE_ENV ??= 'test'
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/jituo_test'
process.env.JWT_SECRET ??= 'test-jwt-secret-at-least-16-chars'
process.env.ADMIN_USERNAME ??= 'admin'
process.env.ADMIN_PASSWORD_HASH ??= '$2b$10$test-placeholder-hash'
process.env.UPLOAD_DIR ??= 'uploads'
