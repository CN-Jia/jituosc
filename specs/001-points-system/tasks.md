# Tasks: 积分系统

**Input**: `specs/001-points-system/`（plan.md + spec.md + data-model.md + contracts/ + research.md）  
**Branch**: `001-points-system`  
**Tech Stack**: Node.js/TypeScript + Fastify + Prisma + PostgreSQL | Vue 3 + Pinia（前端/后台）

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件，无依赖）
- **[Story]**: 对应 spec.md 用户故事（US1～US4）

---

## Phase 1: Setup（基础准备）

**Purpose**: Prisma schema 扩展 + 核心 service 搭建，所有用户故事的共同前置。

- [ ] T001 在 `backend/prisma/schema.prisma` 中新增 `inviteCode`、`invitedById` 字段到 `User` 模型，并添加自引用关系 `invitees/invitedBy`
- [ ] T002 在 `backend/prisma/schema.prisma` 中新增 `PointBalance` 模型（totalPoints、frozenPoints、lifetimeEarned）
- [ ] T003 [P] 在 `backend/prisma/schema.prisma` 中新增 `PointLog` 模型（含 `PointEventType` 枚举）
- [ ] T004 [P] 在 `backend/prisma/schema.prisma` 中新增 `PointRule` 模型（eventType 唯一）
- [ ] T005 [P] 在 `backend/prisma/schema.prisma` 中新增 `ShopItem` 模型（含 `ShopItemType` 枚举、stock、discountAmt）
- [ ] T006 在 `backend/prisma/schema.prisma` 中新增 `RedeemOrder` 模型（含 `RedeemStatus` 枚举，关联 User + ShopItem）
- [ ] T007 在 `backend/prisma/schema.prisma` 中新增 `Coupon` 模型（含 `CouponStatus` 枚举，关联 User + RedeemOrder 1:1）
- [ ] T008 执行 `pnpm prisma db push && pnpm prisma generate`（在 `backend/` 目录）
- [ ] T009 创建 `backend/src/services/points.service.ts`，实现核心事务方法：`awardPoints(userId, eventType, refId?, remark?)`——查规则→校余额→原子 upsert PointBalance→写 PointLog，全程在 `prisma.$transaction` 内
- [ ] T010 在 `backend/src/services/points.service.ts` 中实现 `freezePoints(userId, amount, redeemOrderId)`——totalPoints -= amount, frozenPoints += amount，原子事务
- [ ] T011 在 `backend/src/services/points.service.ts` 中实现 `deductFrozen(userId, amount, redeemOrderId)`（审核通过）和 `unfreeze(userId, amount, redeemOrderId)`（审核拒绝）
- [ ] T012 在 `backend/src/services/points.service.ts` 中实现 `generateInviteCode()` 工具函数（6 位随机大写+数字，碰撞重试）

**⚠️ Checkpoint**: T001～T012 完成后，数据库结构和核心 service 就绪，各用户故事可并行推进。

---

## Phase 2: Foundational（注册/订单挂钩）

**Purpose**: 将积分触发逻辑嵌入现有注册流程和订单完成流程——阻塞 US1 的集成测试。

- [ ] T013 修改 `backend/src/routes/auth.ts` 的 `POST /auth/register`：注册时生成并存储 `inviteCode`；若 query/body 携带 `ref` 参数则查找邀请者，写入 `invitedById`；注册成功后调用 `pointsService.awardPoints(inviterId, 'INVITE_REGISTER')`
- [ ] T014 修改 `backend/src/routes/admin/orders.ts` 的订单状态变更逻辑：当状态变为 `COMPLETED` 时，若该用户存在 `invitedById` 且是首笔完成订单，则调用 `pointsService.awardPoints(inviterId, 'INVITE_FIRST_ORDER')` + `pointsService.awardPoints(userId, 'NEW_USER_FIRST_ORDER')`
- [ ] T015 在 `backend/src/routes/admin/orders.ts` 添加辅助查询：判断当前订单是否为该用户的第一笔 COMPLETED 订单（`prisma.order.count({ where: { userId, status: 'COMPLETED' } }) === 1`）

> ⚠️ **跨 Feature 迁移说明**：T014–T015 针对现有旧版 `Order` 模型。Feature 002（商品结算流程）将旧 `Order` 替换为 `ProductOrder`，届时需将上述挂钩迁移至 `backend/src/routes/admin/productOrders.ts` 并将查询改为 `prisma.productOrder.count(...)`。迁移任务已在 Feature 002 的 plan.md"积分系统集成"章节中说明，由 Feature 002 的 T029 承接。在 Feature 002 合并前，本任务按旧 `Order` 实现即可。

**⚠️ Checkpoint**: Phase 2 完成后，注册邀请积分和首购积分自动触发可验证。

---

## Phase 3: US1 — 邀请拉新获得积分（P1）

**Goal**: 用户获得专属邀请链接，分享后新用户注册/首购自动双向发积分。  
**Independent Test**: 用户 A 邀请码注册 B → A 积分 +50；B 订单完成 → A+100、B+30；全程查 `point_logs` 验证。

- [ ] T016 [P] [US1] 在 `backend/src/routes/points.ts` 创建路由文件，注册 `GET /points/invite`（返回 inviteCode、inviteUrl、邀请统计：totalInvited、pendingFirst、completedFirst）
- [ ] T017 [P] [US1] 在 `backend/src/routes/points.ts` 实现 `GET /points/invitees`（分页列出我邀请的用户：nickname、registeredAt、firstOrderAt）
- [ ] T018 [US1] 在 `backend/src/app.ts` 注册积分路由（`app.register(pointsRoutes, { prefix: '/api' })`）
- [ ] T019 [P] [US1] 创建 `frontend/src/pages/invite/index.vue`：展示我的邀请码、一键复制邀请链接、邀请人数统计卡片、邀请列表（已注册/已首购 badge）
- [ ] T020 [P] [US1] 在 `frontend/src/api/index.ts` 添加 `getInviteInfo()`、`getInvitees()` 方法
- [ ] T021 [US1] 在 `frontend/src/router/index.ts` 添加 `/invite` 路由（需登录）
- [ ] T022 [US1] 在 `frontend/src/App.vue` 导航栏（登录后）添加"邀请好友"链接

**⚠️ Checkpoint**: 邀请页功能完整，积分自动发放可验证。

---

## Phase 4: US2 — 积分商城兑换（P1）

**Goal**: 用户在商城浏览套餐/折扣券，提交兑换申请，积分冻结；管理员审核后正式扣减或解冻。  
**Independent Test**: 用户有 500 积分 → 兑换 500 积分商品 → `frozenPoints=500, totalPoints=0` → 管理员通过 → `frozenPoints=0` 积分扣减；拒绝则恢复。

- [ ] T023 [P] [US2] 在 `backend/src/routes/points.ts` 实现 `GET /shop/items`（公开，支持 type 筛选）
- [ ] T024 [P] [US2] 在 `backend/src/routes/points.ts` 实现 `POST /shop/redeem`（校验积分余额 ≥ pointsCost + 库存 > 0 + 无重复待审核 → 创建 RedeemOrder + 调用 `freezePoints`）
- [ ] T025 [P] [US2] 在 `backend/src/routes/points.ts` 实现 `GET /shop/redeem/my`（我的兑换记录，含 coupon 信息）
- [ ] T026 [P] [US2] 创建 `backend/src/routes/admin/points.ts`，实现 `GET /admin/shop/items`（含已下架商品）
- [ ] T027 [P] [US2] 在 `backend/src/routes/admin/points.ts` 实现 `POST /admin/shop/items`（新建商品，zod 校验所有字段）
- [ ] T028 [P] [US2] 在 `backend/src/routes/admin/points.ts` 实现 `PUT /admin/shop/items/:id` 和 `DELETE /admin/shop/items/:id`
- [ ] T029 [P] [US2] 在 `backend/src/routes/admin/points.ts` 实现 `GET /admin/redeem/orders`（status 筛选+分页）
- [ ] T030 [US2] 在 `backend/src/routes/admin/points.ts` 实现 `POST /admin/redeem/orders/:id/approve`：调用 `deductFrozen` + 若 ShopItemType=COUPON 则生成 Coupon 记录（8位唯一码、90天有效期）
- [ ] T031 [US2] 在 `backend/src/routes/admin/points.ts` 实现 `POST /admin/redeem/orders/:id/reject`：调用 `unfreeze` + 更新 RedeemOrder 状态
- [ ] T032 [US2] 在 `backend/src/app.ts` 注册管理端积分路由（`/api/admin`）
- [ ] T033 [P] [US2] 创建 `frontend/src/pages/points/shop.vue`：商品卡片网格（套餐/折扣券 tab），显示积分价格、库存状态，点击兑换弹出确认框
- [ ] T034 [P] [US2] 在 `frontend/src/api/index.ts` 添加 `getShopItems()`、`submitRedeem()`、`getMyRedeems()` 方法
- [ ] T035 [P] [US2] 在 `frontend/src/router/index.ts` 添加 `/points/shop` 路由
- [ ] T036 [P] [US2] 创建 `admin/src/pages/points/shop.vue`：商品管理表格（新建/编辑弹窗/删除）
- [ ] T037 [P] [US2] 创建 `admin/src/pages/points/redeem.vue`：兑换订单列表，支持 status 筛选，通过/拒绝操作（填写备注）
- [ ] T038 [US2] 在 `admin/src/router/index.ts` 添加 `/points/shop`、`/points/redeem` 路由
- [ ] T039 [US2] 在 `admin/src/api/index.ts` 添加管理端商城/兑换相关方法

**⚠️ Checkpoint**: 商城浏览、兑换提交、后台审核全流程可端到端验证。

---

## Phase 5: US3 — 查看积分账户与明细（P2）

**Goal**: 用户在个人中心查看余额、冻结积分、历史明细。  
**Independent Test**: 触发若干积分事件后，明细列表条数与 delta 正确，余额快照与当前 totalPoints 一致。

- [ ] T040 [P] [US3] 在 `backend/src/routes/points.ts` 实现 `GET /points/balance`
- [ ] T041 [P] [US3] 在 `backend/src/routes/points.ts` 实现 `GET /points/logs`（分页，按 createdAt 倒序）
- [ ] T042 [P] [US3] 创建 `frontend/src/pages/points/index.vue`：顶部余额卡片（可用/冻结/累计），下方明细列表（事件类型 badge+delta 颜色+时间）
- [ ] T043 [P] [US3] 在 `frontend/src/api/index.ts` 添加 `getPointBalance()`、`getPointLogs()` 方法
- [ ] T044 [US3] 在 `frontend/src/router/index.ts` 添加 `/points` 路由（需登录）
- [ ] T045 [US3] 在 `frontend/src/App.vue` 导航栏（登录后）添加"我的积分"链接
- [ ] T046 [P] [US3] 在 `frontend/src/pages/profile/index.vue` 积分卡片区域添加跳转到 `/points` 的快捷入口

**⚠️ Checkpoint**: 积分账户页数据完整准确，明细分页正常。

---

## Phase 6: US4 — 管理员管理积分规则与兑换（P2）

**Goal**: 管理员可配置各事件积分奖励值、手动调整用户积分、查看用户积分汇总。  
**Independent Test**: 管理员修改 INVITE_REGISTER 奖励值 → 新邀请触发后按新值发放。

- [ ] T047 [P] [US4] 在 `backend/src/routes/admin/points.ts` 实现 `GET /admin/points/rules` + `PUT /admin/points/rules/:eventType`
- [ ] T048 [P] [US4] 在 `backend/src/routes/admin/points.ts` 实现 `GET /admin/points/users`（积分汇总，含搜索）
- [ ] T049 [P] [US4] 在 `backend/src/routes/admin/points.ts` 实现 `POST /admin/points/adjust`（手动调整，写 ADMIN_ADJUST 类型 PointLog）
- [ ] T050 [P] [US4] 创建 `admin/src/pages/points/index.vue`：规则配置表格（行内编辑积分值/启用开关）+ 用户积分汇总列表（支持搜索 + 手动调整弹窗）
- [ ] T051 [US4] 在 `admin/src/router/index.ts` 添加 `/points` 主页路由
- [ ] T052 [US4] 在 `admin/src/App.vue` 侧边栏新增"积分管理"菜单（含子菜单：规则配置、商城商品、兑换审核）
- [ ] T053 [US4] 在 `admin/src/api/index.ts` 添加 `getPointRules()`、`updatePointRule()`、`getPointUsers()`、`adjustPoints()` 方法

**⚠️ Checkpoint**: 管理端积分功能全部可用，规则修改立即生效。

---

## Phase 7: US3 补充 — 优惠券（P2）

**Goal**: 用户查看自己持有的折扣券，提交订单时可使用优惠码。

- [ ] T054 [P] [US3] 在 `backend/src/routes/points.ts` 实现 `GET /coupons/my`（返回 UNUSED 状态的优惠券列表）
- [ ] T055 [P] [US3] 在 `frontend/src/pages/points/index.vue` 添加"我的优惠券"tab（展示 code、面值、有效期、状态）
- [ ] T056 [US3] 在 `frontend/src/api/index.ts` 添加 `getMyCoupons()` 方法

---

## Phase 8: Polish & Cross-Cutting

- [ ] T057 [P] 为 `backend/src/services/points.service.ts` 编写核心逻辑 smoke test（使用 Prisma mock 或 in-memory DB）：① `awardPoints` 正确写入 PointBalance + PointLog；② `freezePoints` totalPoints 减少 + frozenPoints 增加；③ `deductFrozen` 审核通过后 frozenPoints 清零；④ `unfreeze` 审核拒绝后 frozenPoints 归还；⑤ `awardPoints` 在 totalPoints 为 0 时不出现负值
- [ ] T057b [P] 在积分商城商品卡片中，当用户积分不足时显示灰色"积分不足"禁用状态
- [ ] T058 [P] `points.service.ts` 补充边界保护：`totalPoints < 0` 时抛出业务异常（`INSUFFICIENT_POINTS`），确保数据库不出现负值
- [ ] T059 [P] 前端所有积分相关数字格式化：三位分隔符（`1,000`），正负 delta 分别用绿色/红色显示
- [ ] T060 [P] 后端所有积分路由补充 zod 参数校验（分页 page/pageSize 范围、delta 为非零整数等）
- [ ] T061 初始化默认 `PointRule` 数据（在后台"规则配置"页首次访问时若无数据则自动 seed：INVITE_REGISTER=50、INVITE_FIRST_ORDER=100、NEW_USER_FIRST_ORDER=30）
- [ ] T062 [P] 在 `specs/001-points-system/quickstart.md` 中补充实际 curl 示例验证积分流程
- [ ] T063 git commit: `feat: 积分系统完整实现`

---

## Dependencies & Execution Order

### Phase 依赖

```
Phase 1 (Setup/Schema) ──→ Phase 2 (挂钩) ──→ US1/US2/US3/US4 可并行
                                               US3 补充依赖 US2（Coupon 模型由 US2 生成）
```

### 关键依赖链

- **T001～T008** (Schema) → **T009～T012** (Service) → 全部后续
- **T013～T015** (挂钩) → T016/T017 (邀请 API 集成测试)
- **T026～T032** (Admin API) → T036/T037 (Admin 页面)
- **T030** (approve) 依赖 T007（Coupon 模型）

### 并行机会

```bash
# Phase 1 并行组（T002～T007 同时开工，均为 schema 不同模型）
T002 PointBalance + T003 PointLog + T004 PointRule + T005 ShopItem

# US2 后端并行组（均为 points.ts 不同路由）
T023 GET /shop/items + T024 POST /shop/redeem + T025 GET /shop/redeem/my

# 前后端可并行（接口契约已定义）
后端 T026-T032（Admin API）与 前端 T033-T035（前端商城页）并行
```

---

## Implementation Strategy

### MVP（Phase 1 + Phase 2 + US1 核心）

1. 完成 T001～T015（Schema + Service + 注册挂钩）
2. 完成 T016～T022（邀请 API + 前端邀请页）
3. 验证：A 邀请 B 注册积分到账 ✅

### 增量交付

1. MVP ✅ → 加入 US2（商城+兑换）→ 验证兑换全流程
2. 加入 US3（积分明细）→ 验证账户透明度
3. 加入 US4（管理规则）→ 验证管理灵活性
4. Polish → 上线

---

## Notes

- [P] = 不同文件/不同功能域，无依赖，可并行
- 所有积分增减必须经 `points.service.ts`，禁止在路由层直接操作 `point_balances`
- `pointsCost` 在创建 `RedeemOrder` 时快照，防止改价影响历史记录
- 自邀请保护：T013 中注册时检查 `inviterId !== newUserId`
