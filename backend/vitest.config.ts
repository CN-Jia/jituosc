import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // 测试环境变量兜底（让 config/env.ts 的校验通过，本地无需 .env）
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/app.ts'],
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 }
    }
  }
})
