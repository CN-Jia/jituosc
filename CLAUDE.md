# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**jituo** — 作业/毕设需求对接与进度追踪系统。pnpm monorepo，三个工作区，部署在 `jituo.cc.cd`。

## Essential Commands

```bash
# 开发（全部从仓库根目录运行）
pnpm dev:backend          # Fastify API → localhost:3000（tsx watch 热重载）
pnpm dev:admin            # Admin 面板 → localhost:5174（Vite HMR）

# 单独进入工作区运行
pnpm --filter backend dev           # 或 cd backend && pnpm dev
pnpm --filter admin dev             # 或 cd admin && pnpm dev
pnpm --filter jituo-frontend dev    # 前端 → localhost:5175

# 测试（仅后端）
pnpm test                          # vitest run
pnpm --filter backend test:watch   # 监听模式
pnpm test:coverage                 # 含覆盖率

# 数据库
pnpm --filter backend db:migrate   # prisma migrate dev
pnpm --filter backend db:generate  # prisma generate（修改 schema 后必须运行）
pnpm --filter backend db:studio    # prisma studio 可视化管理
pnpm --filter backend db:seed      # 填充种子数据

# 构建
pnpm build:backend                 # tsc → backend/dist/
pnpm build:admin                   # vite build → admin/dist/
```

**环境变量**：复制 `backend/.env.example` 为 `backend/.env` 并填入真实值。Zod schema 在 `backend/src/config/env.ts`，启动时校验。

## Architecture

### Backend（`backend/`）

Fastify v4 + TypeScript + Prisma（PostgreSQL）。入口：`src/app.ts`，通过 `buildApp()` 构建实例（测试可复用）。

**请求生命周期**：
```
插件（CORS → JWT → Multipart）→ 限流钩子 → preHandler（鉴权）→ 路由 handler → onError
```

**路由模式**：每个文件导出一个 `async (fastify: FastifyInstance)` 函数，在 `app.ts` 中以 `/api` 前缀注册。用户路由位于 `src/routes/`，管理员路由位于 `src/routes/admin/`，两者对应用户侧和管理侧的相同资源。

**职责分离**：
- **Routes** — 薄层：Zod 校验 → 调用 service → 返回统一响应
- **Services** — 业务逻辑，含数据库操作
- **Middlewares** — `verifyJWT`（用户鉴权，设置 `request.user.userId`）、`verifyAdmin`（管理员鉴权，检查 `role === 'admin'`）
- **Plugins** — Fastify 插件（cors、jwt、multipart），位于 `src/plugins/`
- **Utils** — 辅助工具：`response.ts`（`successResponse`/`errorResponse`/`ERROR_CODES`）、`logger.ts`、`order-id.ts`、`order-status.ts`、`dateFlex.ts`、`imageRef.ts`

**统一响应格式**：
```ts
// 始终使用这两个工具，禁止直接返回原始对象
{ success: true, data: T }
{ success: false, error: { code: string, message: string } }
```

**鉴权**：JWT 令牌负载：用户为 `{ userId, role: 'user' }`，管理员为 `{ role: 'admin' }`。用户路由使用 `{ preHandler: [verifyJWT] }`，管理员路由使用 `{ preHandler: verifyAdmin }`。

**Prisma 客户端**：单例，位于 `src/lib/prisma.ts`，仅从该文件导入。

**文件上传**：`@fastify/multipart` 处理 multipart，文件通过 `/uploads/` 前缀的静态文件服务提供。上传根目录由 `UPLOAD_DIR` 环境变量（默认 `uploads/`）控制，启动时 `ensureUploadDir()` 确保其存在。也可配置阿里云 OSS。

**通知**：Server酱（serverchan.service.ts）用于新订单时向管理员推送微信通知。Resend（email.service.ts）用于邮件。

### Frontend（`frontend/`）

Vue 3 Composition API + Vite + Pinia + Vue Router。懒加载路由，`meta.requiresAuth` 标记受保护页面。Vite 代理 `/api` 和 `/uploads` 到 `localhost:3000`。

**Store**：`src/store/user.ts` 管理用户认证状态和 `isLoggedIn`。

### Admin（`admin/`）

Vue 3 + Element Plus（中文语言包）+ ECharts + Pinia。Vite 基础路径 `/admin/`，代理 `/api`、`/s`、`/uploads` 到 `localhost:3000`。Element Plus 图标全局注册，`zhCn` 语言包，通过 `useTheme` composable 支持暗色模式。

**Store**：`src/store/admin.ts` 管理管理员认证状态。

### 数据库（Prisma）

16 个模型涵盖完整的作业对接业务领域。关键关系：
- `User` — 邀请系统（自引用 `invitedBy`/`invitees`），关联 Order、Post、Comment、Feedback、PointBalance、PointLog、Coupon、ProductOrder
- `Order` — 核心实体：需求订单，含状态流转（PENDING → ACCEPTED → IN_PROGRESS → COMPLETED/CLOSED），`StatusHistory` 追踪每次变更
- `Product` / `ProductOrder` — 商品及订单，支持 `PromoCoupon` 优惠码
- `PointBalance` / `PointLog` / `PointRule` / `ShopItem` / `RedeemOrder` — 完整积分系统
- `Post` / `Comment` — 论坛（帖子需审核：PENDING → APPROVED/REJECTED）
- `Notification` / `AdminNotification` — 双通道通知（用户侧 + 管理员侧）
- `PaymentConfig` — 单例收款码配置（id = "singleton"）
- `Carousel` — 历代作品展示
- `Activity` — 促销/公告

修改 schema 后始终运行 `prisma generate`。

### Spec-Kit

项目集成了 Spec-Kit 工作流框架。`.specify/templates/` 中的模板用于功能规格说明、计划、任务及检查清单。`.github/agents/` 中的 agent 定义提供了 speckit 命令（analyze、checklist、clarify、constitution、implement、plan、specify、tasks、taskstoissues 及 git 相关命令）的 AI agent 行为说明。
