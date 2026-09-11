# ai-jthub 后端重构日志

> 依据方案：`docs/refactor-plan.md`
> 方向：保留 Node.js + Fastify + Prisma + PostgreSQL，借鉴芋道分层/模块化思想
> 范围：Phase 0 + Phase 1（RBAC 暂不做，Phase 2 跳过）

---

## 时间线

### 2026-09-11 16:35 — Phase 0 开始
- ✅ 创建桌面目录 `C:\Users\Administrator\Desktop\jthub`
- ✅ `git clone https://github.com/CN-Jia/ai-jthub.git`（git 2.55.0.windows.3）
- ✅ 转移重构方案 → `docs/refactor-plan.md`
- ✅ 建立本日志 `REFACTOR_LOG.md`
- ✅ 盘点 `backend/src` 结构：
  - `app.ts` 入口
  - `config/env.ts`、`lib/prisma.ts`
  - `middlewares/`（auth、ratelimit）
  - `plugins/`（cors、jwt、multipart）
  - `routes/`（用户侧 13 个 + `routes/admin/` 管理侧 14 个）
  - `services/`（auth、order、points、productOrder、email、notify 等）
  - `utils/`（response、logger、order-id、order-status、dateFlex、imageRef）

### 2026-09-11 — Phase 0 + Phase 1 完成

**Phase 0（环境准备）：**
- ✅ 依赖安装：修复 pnpm 12 的 `allowBuilds` 配置（`pnpm-workspace.yaml`），bcrypt/esbuild/prisma 原生依赖构建成功
- ✅ `prisma generate`：修复 `@prisma/client` 类型未生成的问题
- ✅ 修复预存测试 bug：`order-status.test.ts` 测的是 v1.1 之前的旧状态机（PENDING→ACCEPTED），与当前代码不一致

**Phase 1（后端分层 + 模块化重构）：**
- ✅ `framework/errors.ts`：HttpError + 错误码→HTTP 状态码映射 + 统一异常识别
- ✅ `framework/response.ts`：统一响应 + 扩充错误码枚举（新增 CONFLICT / PRODUCT_NOT_FOUND / COUPON_* / INSUFFICIENT_POINTS 等）
- ✅ `utils/response.ts` → 改为 re-export 兼容层
- ✅ 按业务域拆 7 个模块：`system` / `order` / `points` / `product` / `forum` / `content` / `marketing`
- ✅ order 模块示范完整分层：`repository`（VO select 白名单）+ `service`（业务 + 事务）+ `notify` + 用户/管理路由
- ✅ 统一错误处理：service 抛 `HttpError`，全局 `setErrorHandler` 识别业务错误码返回正确状态码（原来散落的 try/catch + 魔法字符串错误被收敛）
- ✅ `app.ts` 改为模块化注册（14 个模块路由统一 `/api` 前缀）
- ✅ 删除旧 `routes/` 与 `services/`（保留跨模块的 `email.service.ts`）
- ✅ 修复历史 GBK 乱码注释（adminNotifications / products / promoCoupons / paymentConfig 等）

**验证结果：**
- ✅ `tsc --noEmit` 通过（0 错误）
- ✅ `pnpm build` 通过（dist 生成）
- ✅ `pnpm test` 通过（6 passed）

**待办（需 PostgreSQL + .env 环境）：**
- [ ] 三端启动回归验证（接口契约应与重构前完全一致）
- [ ] RBAC（Phase 2，已决定暂不做）
