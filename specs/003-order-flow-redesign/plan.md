# Implementation Plan: 订单流程重构

**Spec**: `specs/003-order-flow-redesign/spec.md`
**Created**: 2026-05-04

---

## Phase 1 — 隐藏选购入口（30min）

- [ ] 首页 Hero 按钮：`立即选购` → `立即提交`，跳转 `/submit`
- [ ] 首页 CTA 按钮：`立即选购` → `提交需求`
- [ ] 导航栏：隐藏「立即选购」链接（CSS display:none）
- [ ] 移动端底部导航：`选购` → `提交`，跳转 `/submit`

---

## Phase 2 — 订单状态重构（2h）

- [ ] 更新 `backend/prisma/schema.prisma`：OrderStatus 枚举改为 CREATED/PENDING/IN_PROGRESS/COMPLETED/CANCELLED
- [ ] Order 模型新增 `estimatedDelivery`、`rewardPoints`、`redeemItemId` 字段
- [ ] OrderType 模型新增 `pointRewardRate` 字段
- [ ] RedeemOrder 模型新增 `usedAt`、`usedOrderId`、`expiresAt` 字段
- [ ] 运行 `prisma migrate dev`
- [ ] 更新 `order-status.ts`：状态流转规则
- [ ] 更新 `order.service.ts`：createOrder 适配新状态
- [ ] 更新 `admin/orders.ts`：状态更新逻辑，IN_PROGRESS 校验交付时间，COMPLETED 发放积分

---

## Phase 3 — 提交需求页重写（2h）

- [ ] `frontend/src/pages/submit/index.vue`：重写表单布局
- [ ] 新增 API：`GET /api/redeem/my-available` 查询用户可用的兑换项
- [ ] 新增下拉框：服务套餐/折扣券选择
- [ ] 折扣自动计算逻辑
- [ ] 提交后引导添加微信

---

## Phase 4 — 积分商城调整（1h）

- [ ] 兑换 API：移除管理员审核，满足条件直接生效
- [ ] 兑换时计算并写入 `expiresAt`
- [ ] 前端兑换项显示有效期倒计时
- [ ] 过期自动失效逻辑

---

## Phase 5 — 论坛改版（2h）

- [ ] Post 模型新增 `board` 字段，运行迁移
- [ ] 后端帖子 API 支持 `board` 过滤
- [ ] 前端论坛页改为多板块 tab
- [ ] 管理端帖子管理适配板块筛选
- [ ] 种子数据：管理员预置服务说明和 FAQ 帖子

---

## Phase 6 — 管理端适配（1.5h）

- [ ] 订单详情页：适配新状态操作按钮
- [ ] IN_PROGRESS 弹窗：填写预计交付时间
- [ ] COMPLETED 自动计算积分 + 可手动调整
- [ ] 需求类型管理：新增积分比例配置
- [ ] Seed 更新：默认积分比例

---

## Phase 7 — 测试 & 部署（1h）

- [ ] 全流程测试：提交需求→选择折扣→创建订单→状态流转→积分发放
- [ ] 积分兑换测试：兑换→过期→使用
- [ ] 论坛板块测试：发帖→审核→展示
- [ ] 构建三端，部署
