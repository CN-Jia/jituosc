# ai-jituo 重构方案（借鉴 ruoyi-vue-pro 工程化思想）

> 方向：**保留 Node.js + Fastify + Prisma + PostgreSQL 技术栈不变**，借鉴芋道（ruoyi-vue-pro）的
> **领域模块化 + 四层分层（route/service/repository/dto-vo）** 思想，重构后端结构。
> 前端/管理端接口契约不变，**零感知**。

---

## 一、现状盘点（重构要解决的问题）

| # | 问题 | 证据 | 危害 |
|---|---|---|---|
| 1 | **route 层过肥** | `auth.ts` 18KB、`points.ts` 10KB、`admin/points.ts` 11KB、`admin/luckyWheel.ts` 11KB | Zod 校验、业务逻辑、Prisma 调用、响应组装全堆在一层，难读难测难改 |
| 2 | **service 覆盖不全** | `auth.service.ts` 仅 276 字节，业务逻辑实际藏在 route 里 | 分层名存实亡 |
| 3 | **无 repository 层** | Prisma client 直接散落在 route 和 service 里 | 数据访问逻辑无法复用/替换/单测 |
| 4 | **无 DTO/VO 隔离** | 出参直接返回 Prisma model，入参 Zod 内联在 route | `passwordHash` 等敏感字段有外泄风险；出入参契约不清晰 |
| 5 | **模块平铺** | `routes/` 按资源堆文件，用户路由与 admin 路由按"人"分、不按"业务域"分 | 同一业务域（如订单）的逻辑散落多处 |
| 6 | **权限只有两态** | 只有 `verifyJWT` / `verifyAdmin` | 无 RBAC 扩展点，加"运营/客服"等角色要改代码 |
| 7 | **文档与代码脱节** | CLAUDE.md 写 16 个模型，实际 schema 有 **25 个 model** | 后续维护认知成本高 |

---

## 二、目标架构

### 2.1 分层（翻译芋道 `controller/service/dal/convert` 到 Node 生态）

| 芋道（Java） | ai-jituo（Node/Fastify） | 职责 |
|---|---|---|
| controller | **route**（薄层） | 只做：Zod 校验 → 调 service → 返回统一响应 |
| service(+Impl) | **service** | 业务逻辑、事务编排、跨表规则 |
| dal / dataobject / mapper | **repository** | 封装 Prisma CRUD，service 不直接碰 Prisma client |
| convert（DTO/VO） | **dto/ + vo/** | 入参 Zod 校验、出参字段裁剪（白名单） |
| api（对外接口定义） | 模块间只通过 service 单向调用 | 避免循环依赖 |
| framework | **framework/** | 配置、日志、统一响应、鉴权、插件、DB 单例 |

### 2.2 目录结构（backend）

```
backend/src/
├── app.ts                    # 入口：装配 plugin + 注册各模块路由
├── framework/                # 框架层（≈ yudao-framework）
│   ├── config/env.ts         # 配置（Zod 校验）
│   ├── logger.ts
│   ├── http/                 # response.ts（统一响应）+ error.ts（全局异常）
│   ├── auth/                 # verifyJWT / verifyAdmin（收敛到一处）
│   ├── plugins/              # cors / jwt / multipart
│   └── db/prisma.ts          # Prisma 单例
├── modules/                  # 业务模块（≈ yudao-module-*）
│   ├── system/               # 用户/认证
│   ├── order/                # 需求订单
│   ├── product/              # 商品/交易
│   ├── points/               # 积分
│   ├── forum/                # 论坛
│   ├── content/              # 内容运营
│   └── marketing/            # 营销活动
└── shared/                   # 跨模块共享：枚举、ERROR_CODES、工具
```

### 2.3 领域模块划分（25 个 model 归位）

| 模块 | 模型 | 现有路由（迁移来源） |
|---|---|---|
| **system** | User、EmailVerification | `auth.ts`、`admin/users.ts`、`admin/system.ts` |
| **order** | Order、OrderType、StatusHistory、Notification | `orders.ts`、`admin/orders.ts`、`admin/order-types.ts`、`adminNotifications.ts` |
| **product** | Product、ProductOrder、PromoCoupon、PaymentConfig、AdminNotification | `products.ts`、`productOrders.ts`、`promoCoupons.ts`、`admin/products.ts`、`admin/productOrders.ts`、`admin/promoCoupons.ts`、`admin/paymentConfig.ts` |
| **points** | PointBalance、PointLog、PointRule、ShopItem、RedeemOrder、Coupon | `points.ts`、`admin/points.ts` |
| **forum** | Post、Comment | `posts.ts`、`admin/posts.ts` |
| **content** | Activity、Carousel、Feedback | `carousel.ts`、`feedback.ts`、`admin/activities.ts`、`admin/carousel.ts`、`admin/feedback.ts` |
| **marketing** | WheelPrize、SpinResult、ActivityPopup | `luckyWheel.ts`、`admin/luckyWheel.ts` |

每个模块内部统一结构：

```
modules/<module>/
├── <module>.route.ts          # 用户侧路由
├── <module>.admin.route.ts    # 管理侧路由
├── <module>.service.ts        # 业务逻辑
├── <module>.repository.ts     # 数据访问（Prisma CRUD）
├── dto/                       # 入参 Zod schema
└── vo/                        # 出参 select 白名单 + 类型
```

---

## 三、关键设计决策

1. **DTO/VO 分离**（最高优先级，含安全修复）
   - 入参：每个接口一个 Zod schema，放 `dto/`，route 里只 `schema.parse(body)`。
   - 出参：repository/service 用 Prisma `select` 白名单，**绝不直接返回整个 model**——先修掉 `passwordHash`、`PasswordHash` 等字段外泄隐患。

2. **统一错误处理**（≈ 芋道 `ServiceException` + 错误码枚举）
   - 已有 `ERROR_CODES`，收敛为一个 `HttpError` 类 + Fastify 全局 `setErrorHandler`。
   - service 层只 throw 业务错误，route 层不写 try/catch 包响应。

3. **模块间依赖单向化**
   - 例：`order` 完成时要发积分 → 通过 `points.service` 的方法调用，而不是 order 直接写 PointLog。
   - 用 Fastify `decorate` 或轻量 service 单例注册，避免 import 循环。

4. **RBAC（Phase 2，可选）**
   - 新增 `Role` / `Permission` / `UserRole` 表，`verifyJWT` 升级为「读用户角色→查权限」。
   - Phase 1 先保留 `verifyJWT`/`verifyAdmin` 两态，但把鉴权逻辑收敛到 `framework/auth/`，为升级留口子。
   - ⚠️ 对这个个人项目，完整 RBAC 可能过度设计——**由你在 review 时决定要不要做**。

5. **数据库策略**
   - 保持 PG + Prisma 不变；新增表用 `prisma migrate` 管理，不破坏现有 25 个模型。
   - 枚举、共享常量抽到 `shared/`，消除 magic string。

6. **前端/管理端不动**
   - 接口路径、请求/响应 JSON 结构完全兼容，前端零改动。

---

## 四、分阶段实施计划

### Phase 0 — 准备（0.5 天）
- clone 代码 + 建 `refactor/backend-layering` 分支
- 本地跑通三端，建立 `pnpm test` 基线
- 补少量「冒烟测试」：auth/orders/points 各一条 happy path（用已有 vitest + supertest 基建）

**验收**：基线测试全绿，记录当前接口行为快照。

### Phase 1 — 后端骨架重构，无行为变更（3–5 天）★ 核心
按模块迁移（一次一个模块，逐步提交）：
1. 建 `framework/`、`modules/`、`shared/` 骨架，`app.ts` 改为注册各模块路由
2. 每个模块：route（瘦身）→ service（搬业务）→ repository（抽 Prisma）→ dto/vo
3. 抽 `HttpError` + 全局 `setErrorHandler`
4. **顺手修 VO 白名单**，堵敏感字段外泄
5. 迁移顺序建议：system → order → points → product → forum → content → marketing

**验收**：`pnpm test` 全绿；三端启动正常；对现有页面做一轮手动回归，接口 JSON 与重构前完全一致。

### Phase 2 — 权限升级 RBAC（2–3 天，可选）
- 新增角色/权限表 + 种子数据（admin / user）
- 鉴权从「两态」升级为「角色→权限」；admin 路由按权限点校验
- 管理端用户管理页加「分配角色」

**验收**：能新建角色、分配权限、权限生效；现有 admin 功能不受影响。

### Phase 3 — 基础设施补齐（按需，2–3 天，可选）
- 操作日志表 + 中间件（记录 admin 关键操作）
- 通用「字典/配置」表（把 PaymentConfig / ActivityPopup 这类单例配置统一起来）
- 定时任务（`node-cron`）：优惠券过期、超时订单关闭、抽奖库存回滚

**验收**：配置可在后台改；定时任务可观测。

### Phase 4 — 前端/管理端工程化（可选，后期）
- 若要做，参考芋道 yudao-ui 的：api 按模块封装、请求层统一、组件复用。

---

## 五、风险与原则

- **向后兼容是底线**：接口契约不变，前端零改动；任何返回字段变化都要先确认。
- **小步提交**：一个模块一次提交，每步可回滚；不做「一次大爆炸」重写。
- **先测试后重构**：Phase 0 补的冒烟测试是 Phase 1 的安全网。
- **安全优先**：VO 白名单（敏感字段外泄）放进 Phase 1 一起做，不拖到后面。

---

## 六、工作量粗估

| 阶段 | 工作量 | 是否必须 |
|---|---|---|
| Phase 0 准备 | 0.5 天 | 必须 |
| Phase 1 骨架重构 | 3–5 天 | **必须** |
| Phase 2 RBAC | 2–3 天 | 可选 |
| Phase 3 基础设施 | 2–3 天 | 可选 |
| Phase 4 前端工程化 | 待定 | 可选 |

**核心（Phase 0+1）约 4–6 天**，即可拿到一个「分层清晰、有 repository 层、出入参隔离、模块化」的后端，且线上行为不变。
