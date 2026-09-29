# Implementation Plan: 商品列表与订单结算流程

**Branch**: `002-product-shop-checkout` | **Date**: 2026-04-29 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/002-product-shop-checkout/spec.md`

---

## Summary

将现有"提交需求"订单系统**完全替换**为商品驱动的购买结算流程。用户浏览管理员配置的商品列表，选购后输入优惠码（可选），弹出微信/支付宝收款码完成线下扫码支付，点击"我已支付"触发状态变更并向管理员推送站内通知，管理员在后台确认后将订单标记为完成。订单状态机：**已创建 → 已支付 → 已完成 / 已取消**。

---

## Technical Context

**Language/Version**: Node.js 20 (TypeScript 5) — Backend；Vue 3.4 + TypeScript — Frontend/Admin  
**Primary Dependencies**: Fastify + Prisma (backend)；Vue Router + Pinia + Axios (frontend)；Element Plus (admin)  
**Storage**: PostgreSQL（现有数据库，新增表/删除旧表）  
**Testing**: 手动测试为主；核心 service 层关键状态流转写单元测试  
**Target Platform**: Linux 服务器（Ubuntu 24 LTS），Nginx 反向代理  
**Project Type**: Web 全栈应用（Monorepo：backend / frontend / admin）  
**Performance Goals**: 商品列表加载 < 2s；优惠码校验 < 300ms；通知推送延迟 < 1s  
**Constraints**: 不接入第三方支付 SDK；收款码为静态图片；单品订单；优惠码不可叠加  
**Scale/Scope**: 小型平台，用户量 < 1000，并发低

---

## Constitution Check

| 原则 | 状态 | 说明 |
|------|------|------|
| I. 代码质量优先 | ✅ 通过 | 复用现有 auth/middleware，不重复造轮子 |
| II. 测试覆盖 | ✅ 通过 | 订单状态流转、优惠码校验需单元测试 |
| III. UX 一致性 | ✅ 通过 | 延续现有 H5 响应式风格，移动端优先 |
| IV. 性能与可观测性 | ✅ 通过 | 结构化日志记录关键操作；错误统一处理 |
| V. 简洁性 | ⚠️ 注意 | 需删除旧 OrderType/Order 系统，避免两套并存 |
| 安全要求 | ✅ 通过 | 复用 JWT 鉴权；优惠码后端二次校验防并发 |

**GATE 结论**：无阻断性违规，可进入 Phase 0。  
**需特别注意**：删除旧系统时需做数据迁移评估（若生产已有历史订单数据，需讨论处理策略）。

---

## Project Structure

### Documentation (this feature)

```text
specs/002-product-shop-checkout/
├── plan.md              # 本文件
├── research.md          # Phase 0 研究产出
├── data-model.md        # Phase 1 数据模型
├── contracts/           # Phase 1 API 合约
│   ├── products.md
│   ├── orders.md
│   ├── coupons.md
│   └── notifications.md
└── tasks.md             # Phase 2 任务拆分（/speckit.tasks 产出）
```

### Source Code Layout

```text
backend/src/
├── routes/
│   ├── products.ts          # 新增：商品列表（公开）
│   ├── orders.ts            # 改写：新订单流程（替换旧版）
│   ├── coupons.ts           # 新增：优惠码校验
│   ├── notifications.ts     # 新增：管理员通知读取
│   └── admin/
│       ├── products.ts      # 新增：商品 CRUD
│       ├── orders.ts        # 改写：新订单管理
│       ├── coupons.ts       # 新增：优惠码生成管理
│       ├── payment-config.ts # 新增：收款码图片管理
│       └── notifications.ts # 新增：通知查询/已读
├── services/
│   ├── order.service.ts     # 订单状态机、创建、校验
│   ├── coupon.service.ts    # 优惠码校验（含并发锁）
│   └── notification.service.ts # 通知创建与推送
└── prisma/schema.prisma     # 新增模型，删除旧模型

frontend/src/
├── pages/
│   ├── products/index.vue   # 新增：商品列表页
│   ├── products/detail.vue  # 新增：商品详情/购买确认页
│   ├── orders/index.vue     # 改写：我的订单列表
│   └── orders/detail.vue    # 改写：订单详情页（含支付弹窗）
└── components/
    └── PaymentModal.vue     # 新增：收款码弹窗组件

admin/src/
├── pages/
│   ├── products/index.vue   # 新增：商品管理
│   ├── orders/index.vue     # 改写：新订单管理（替换旧版）
│   ├── coupons/index.vue    # 新增：优惠码管理
│   └── payment-config/index.vue # 新增：收款码配置
└── components/
    └── NotificationBell.vue # 新增：顶栏铃铛通知组件
```

**Structure Decision**: Monorepo Option 2（Web 全栈），在现有 backend/frontend/admin 三个项目内分别新增/改写对应模块。

---

## Phase 0: Research

详见 [research.md](research.md)

**关键决策点**：
1. 优惠码并发控制：Prisma 乐观锁（`version` 字段）+ 数据库唯一约束
2. 通知推送机制：Polling（前端每 30s 轮询）vs SSE vs WebSocket → 选 **Polling**（简单、无需额外基础设施）
3. 旧订单数据处理：生产环境迁移策略

---

## Phase 1: Design

### 数据模型变更

详见 [data-model.md](data-model.md)

**新增模型**：`Product`、新版 `ProductOrder`（替换旧版 `Order`）、`PromoCoupon`（促销优惠码，区别于积分兑换产生的 `Coupon`）、`PaymentConfig`、`Notification`  
**删除模型**：`OrderType`（旧需求类型）  
**保留模型**：`User`、`Post`、`Comment`、`Feedback`、`Carousel`、`PointBalance`、`PointLog`、`Coupon`（积分系统兑换券，Feature 001 产出，不修改）等

> **命名约定**：本 feature 的促销优惠码模型统一命名为 `PromoCoupon`（对应后台路由文件 `admin/promoCoupons.ts`、service 文件 `coupon.service.ts`），以避免与 Feature 001 中积分兑换生成的 `Coupon` 产生 Prisma schema 冲突。

### 订单状态机

```
已创建(CREATED)
    │
    ├──[用户点击"我已支付"]──▶ 已支付(PAID)
    │                              │
    │                    [管理员确认完成]
    │                              │
    │                         已完成(COMPLETED)
    │
    └──[管理员取消 / 任意未完成阶段]──▶ 已取消(CANCELLED)
```

### API 合约概览

详见 [contracts/](contracts/)

| 端点 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/api/products` | GET | 公开（需登录） | 商品列表 |
| `/api/products/:id` | GET | 公开（需登录） | 商品详情 |
| `/api/orders` | POST | 用户 | 创建订单 |
| `/api/orders/my` | GET | 用户 | 我的订单列表 |
| `/api/orders/:id` | GET | 用户 | 订单详情 |
| `/api/orders/:id/pay` | POST | 用户 | 标记已支付 |
| `/api/coupons/validate` | POST | 用户 | 校验优惠码 |
| `/api/notifications` | GET | 管理员 | 获取通知列表 |
| `/api/notifications/:id/read` | PUT | 管理员 | 标记已读 |
| `/api/admin/products` | GET/POST | 管理员 | 商品列表/新增 |
| `/api/admin/products/:id` | PUT/DELETE | 管理员 | 编辑/删除商品 |
| `/api/admin/orders` | GET | 管理员 | 所有订单 |
| `/api/admin/orders/:id/complete` | PUT | 管理员 | 完成订单 |
| `/api/admin/orders/:id/cancel` | PUT | 管理员 | 取消订单 |
| `/api/admin/coupons` | GET/POST | 管理员 | 优惠码列表/新增 |
| `/api/admin/coupons/:id` | DELETE | 管理员 | 删除优惠码 |
| `/api/admin/payment-config` | GET/PUT | 管理员 | 收款码图片配置 |

---

## 积分系统集成（Feature 001 交叉点）

Feature 001（积分系统）在旧版 `admin/orders.ts` 中挂钩监听 `Order.status → COMPLETED` 以触发邀请首购积分奖励。本 feature 将旧 `Order` 替换为 `ProductOrder`，**必须同步迁移此挂钩**，否则积分首购奖励将永久失效。

**集成方案**：
- 在 `backend/src/routes/admin/productOrders.ts` 的 `PUT /api/admin/orders/:id/complete` 接口中，复用 Feature 001 的 `pointsService.awardPoints` 逻辑：
  1. 查询 `ProductOrder` 的 `userId`，检查其是否存在 `user.invitedById`
  2. 判断是否为该用户第一笔 `COMPLETED` 的 `ProductOrder`（`prisma.productOrder.count({ where: { userId, status: 'COMPLETED' } }) === 1`）
  3. 若满足，调用 `pointsService.awardPoints(inviterId, 'INVITE_FIRST_ORDER')` + `pointsService.awardPoints(userId, 'NEW_USER_FIRST_ORDER')`
- Feature 001 的原始 T014–T015 任务在 002 部署后**不再适用**，由本 feature 的 T029 承接此逻辑（详见 tasks.md T029-migration）

## Complexity Tracking

无 Constitution 违规需要在此记录。

唯一注意项（非违规）：删除旧 `OrderType` + 旧 `Order` 表前需确认生产数据迁移方案，建议实施前备份数据库。
