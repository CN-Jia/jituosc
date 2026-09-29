# Implementation Plan: 积分系统

**Branch**: `001-points-system` | **Date**: 2026-04-28 | **Spec**: [spec.md](./spec.md)

## Summary

为 极拓空间 平台新增积分体系，涵盖：拉新邀请获积分（邀请者+新人双向奖励）、积分商城（固定套餐 + 折扣券）、兑换审核流程（冻结→审核→扣减/解冻）、管理后台全套管理模块。在现有 Fastify + Prisma + PostgreSQL 后端与 Vue 3 + Pinia 前端上扩展，不引入新框架。

## Technical Context

**Language/Version**: TypeScript 5.x (后端 Node.js 20 LTS, 前端 Vue 3.4)  
**Primary Dependencies**: Fastify、Prisma 5、Pinia、Element Plus（admin）、现有 zod 校验  
**Storage**: PostgreSQL（现有 DATABASE_URL），Prisma ORM 扩展  
**Testing**: 当前项目无测试框架，积分核心 service（余额增减、冻结/解冻）需补充手动 smoke test  
**Target Platform**: Ubuntu 24 LTS 服务器，Nginx 反代，PM2 进程管理  
**Project Type**: Web Service（API） + Web Application（前端/后台）  
**Performance Goals**: 积分发放 < 5s，商城列表 < 1s，兑换操作响应 < 300ms  
**Constraints**: 积分不可为负；兑换时并发需防重复扣减（乐观锁或事务）  
**Scale/Scope**: < 1000 用户，< 100 商城商品，个人项目规模

## Constitution Check

| 原则 | 状态 | 说明 |
|------|------|------|
| 代码质量（I） | ✅ | 积分增减逻辑封装至独立 service，DRY |
| 测试覆盖（II） | ⚠️ 部分 | 核心 service（余额变更、冻结）写 smoke test |
| UX 一致性（III） | ✅ | 复用现有前端 CSS 变量和卡片组件风格 |
| 性能可观测（IV） | ✅ | 关键操作记录结构化日志，Prisma 事务保证一致性 |
| 简洁性 YAGNI（V） | ✅ | 不做多级裂变、积分过期、积分提现等超出需求功能 |
| 安全（Security） | ✅ | 积分操作全部走 JWT 鉴权；数量字段服务端校验非负 |

**GATE 结论**：无违规，可进入 Phase 0。

## Project Structure

### Documentation (this feature)

```text
specs/001-points-system/
├── plan.md              ← 本文件
├── research.md          ← Phase 0
├── data-model.md        ← Phase 1
├── quickstart.md        ← Phase 1
└── contracts/
    ├── points-api.md    ← 用户端 API 契约
    └── admin-points-api.md ← 管理端 API 契约
```

### Source Code

```text
backend/
├── prisma/
│   └── schema.prisma          ← 新增 PointBalance, PointLog, Invitation,
│                                  ShopItem, RedeemOrder, PointRule, Coupon
├── src/
│   ├── services/
│   │   └── points.service.ts  ← 核心积分业务逻辑（发放、冻结、扣减、解冻）
│   └── routes/
│       ├── points.ts          ← 用户端：邀请码、积分明细、商城、兑换
│       └── admin/
│           └── points.ts      ← 管理端：规则配置、商城CRUD、兑换审核

frontend/
└── src/
    ├── pages/
    │   ├── points/
    │   │   ├── index.vue      ← 积分账户总览 + 明细
    │   │   └── shop.vue       ← 积分商城
    │   └── invite/
    │       └── index.vue      ← 邀请页（我的邀请码 + 邀请记录）
    └── api/index.ts           ← 扩展 points/shop/invite 相关方法

admin/
└── src/
    ├── pages/
    │   └── points/
    │       ├── index.vue      ← 规则配置 + 总览
    │       ├── shop.vue       ← 商城商品管理
    │       └── redeem.vue     ← 兑换订单审核
    ├── router/index.ts        ← 新增 /points 相关路由
    └── api/index.ts           ← 扩展管理端 points 方法
```

**Structure Decision**: Option 2（Web application），在现有 backend/frontend/admin 目录内扩展。

## Phases

### Phase 0 — Research ✅ (见 research.md)

### Phase 1 — Design & Contracts ✅ (见 data-model.md、contracts/)

### Phase 2 — Implementation Tasks (见 tasks.md，由 /speckit.tasks 生成)

实现顺序（依赖链）：

1. **P1-DB**: Prisma schema 新增积分相关模型 → `db push` → `prisma generate`
2. **P1-SVC**: `points.service.ts` 核心逻辑（事务安全的发放/冻结/扣减/解冻）
3. **P1-HOOK**: 在订单支付完成（`OrderStatus → COMPLETED`）处挂钩触发拉新积分
4. **P1-AUTH-HOOK**: 在用户注册成功处挂钩触发注册邀请积分
5. **P2-ROUTE**: 用户端 API（邀请码、明细、商城列表、兑换提交）
6. **P2-ADMIN**: 管理端 API（规则、商城 CRUD、兑换审核）
7. **P3-FE**: 前端页面（积分账户、商城、邀请页）
8. **P3-ADMIN**: 管理后台页面（规则、商品、兑换）

## Complexity Tracking

无 Constitution 违规，本表不需填写。
