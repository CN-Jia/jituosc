# Task List: 极拓空间 v4 开发任务

**Updated**: 2026-05-04 v5（安全加固 + 功能补全 + 代码清理） | **Status**: 基本完成

---

## Phase 1 — 后端数据库扩展 ✅

- [x] **T01** 更新 `prisma/schema.prisma`：重构 `User` 模型
- [x] **T02** 新增 `EmailVerification` 模型
- [x] **T03** 新增 `Post` 模型
- [x] **T04** 新增 `Comment` 模型
- [x] **T04b** 新增 `Feedback` 模型
- [x] **T05** 新增 `Carousel` 模型
- [x] **T06** 运行 `prisma migrate dev` 生成迁移
- [x] **T07** 更新 `prisma/seed.ts`

---

## Phase 2 — 后端认证 API 重写 ✅

- [x] **T08** `POST /auth/register`
- [x] **T09** `POST /auth/send-code`
- [x] **T10** `POST /auth/verify-email`
- [x] **T11** `POST /auth/login`（含失败锁定）
- [x] **T12** `GET /auth/me`
- [x] **T13** `PUT /auth/profile`
- [x] **T14** `PUT /auth/password`
- [x] **T15** `email.service.ts`：Resend 发送验证码
- [x] **T16** `env.ts`：新增 `RESEND_API_KEY` / `MAIL_FROM`
- [x] **T17** `auth.middleware.ts`：适配新 User 模型

---

## Phase 3 — 后端论坛 & 轮播 API ✅

- [x] **T18** `GET /posts`，`GET /posts/:id`
- [x] **T19** `POST /posts/:id/comments`
- [x] **T20** 管理员帖子 CRUD
- [x] **T21** `DELETE /admin/comments/:id`，`PATCH /admin/comments/:id`
- [x] **T22** `GET /carousel`
- [x] **T23** 管理员轮播 CRUD
- [x] **T24** 管理员用户管理
- [x] **T24b** 用户反馈 API
- [x] **T24c** 管理员反馈 API
- [x] **T24d** 论坛审核流程

---

## Phase 4 — 管理后台 UI 深色改版 ✅

- [x] **T25-T36** 全部管理后台页面已完成

---

## Phase 5 — 用户端全面重写 ✅

- [x] **T37-T55** 全部用户端页面已完成

---

## Phase 6 — 安全加固与功能补全（2026-05-04）

### P0 安全修复
- [x] **T59** 管理员登录限流：15分钟内5次失败封IP
- [x] **T60** 移除 sw.js 中的第三方广告脚本（5gvci.com）

### P1 功能补全
- [x] **T61** 忘记密码功能：后端 `POST /auth/forgot-password` + `POST /auth/reset-password`，前端 `/forgot-password` 页面
- [x] **T62** 邮箱验证重发：后端 `POST /auth/resend-verification` + `POST /auth/verify-email`，前端个人中心集成
- [x] **T63** 论坛发帖页面：前端 `/forum/new` 页面
- [x] **T64** 管理员登录后重定向：已登录访问 `/admin/login` 自动跳转仪表盘
- [x] **T65** 修复前端 title：改为「极拓空间 - 专业学业辅助平台」

### P2 代码质量
- [x] **T66** 删除 uni-app 死代码组件（OrderCard.vue、StatusBadge.vue）
- [x] **T67** 统一管理员微信号：通过 `GET /api/config` 动态获取，移除硬编码
- [x] **T68** 搜索大小写不敏感：Prisma 查询加 `mode: 'insensitive'`
- [x] **T69** 管理员回复反馈状态修复：避免重复状态更新
- [x] **T70** 移除 admin vite 无用 `/s` 代理配置

### P3 体验优化
- [x] **T71** 轮播图加载失败 SVG 占位图
- [x] **T72** Markdown 渲染增强：支持标题/斜体/链接/列表
- [x] **T73** 活动列表分页支持
- [x] **T74** DEPLOY.md 移除敏感信息

### 文档更新
- [x] **T75** 更新 spec.md：新增忘记密码 Story、邮箱验证 Story
- [x] **T76** 更新 api-spec.md：完整重写 v3.0
- [x] **T77** 更新 tasks.md：标记已完成任务

---

## 部署清单

```bash
# 服务器执行
cd /var/www/jituo
git pull
pnpm install
pnpm --filter backend build
pnpm --filter jituo-frontend build
pnpm --filter jituo-admin build
cd backend && pnpm prisma migrate deploy && cd ..
pm2 restart jituo-api
```
