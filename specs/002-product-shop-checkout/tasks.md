# Tasks: 商品列表与订单结算流程

**Input**: `specs/002-product-shop-checkout/` (plan.md, spec.md, data-model.md, contracts/, research.md)  
**Total Tasks**: 62  
**User Stories**: 5 (2 × P1, 2 × P2, 1 × P3)

---

## Phase 1: Setup & Cleanup（旧系统移除）

**Purpose**: 清除旧版"提交需求"订单系统，为新系统腾出干净的代码空间。

**⚠️ 警告**: 执行前请备份生产数据库（`pg_dump`）。

- [ ] T001 备份生产数据库，确认 `OrderLegacy`/`OrderTypeLegacy` 命名迁移策略已理解
- [ ] T002 [P] 删除前台旧版订单/需求提交页面：`frontend/src/pages/submit/`、`frontend/src/pages/orders/`（旧版）
- [ ] T003 [P] 删除后台旧版订单管理页面：`admin/src/pages/orders/index.vue`（旧版，之后重建）
- [ ] T004 [P] 删除后台旧版 API 路由：`backend/src/routes/orders.ts`（旧版）和 `backend/src/routes/orderTypes.ts`
- [ ] T005 [P] 清理前台路由 `frontend/src/router/index.ts`：移除旧的 `/submit`、`/orders` 路由入口
- [ ] T006 [P] 清理后台路由 `admin/src/router/index.ts`：移除旧的订单相关菜单项
- [ ] T007 [P] 清理 Pinia store 中旧的订单相关状态：`frontend/src/store/`

**Checkpoint**: 旧系统代码已清除，应用可正常构建（无旧模块引用错误）

---

## Phase 2: Foundational（数据库与基础设施）

**Purpose**: 建立新系统所依赖的数据模型和后端基础服务，所有 User Story 均阻塞于此阶段。

**⚠️ CRITICAL**: 此阶段完成前，任何 User Story 均不可开始。

- [ ] T008 更新 `backend/prisma/schema.prisma`：新增 `Product`、`ProductOrder`、`OrderStatus` 枚举、`PromoCoupon`（促销优惠码，区别于积分系统的 `Coupon` 模型）、`DiscountType` 枚举、`PaymentConfig`、`Notification`、`NotificationType` 枚举（参照 data-model.md）
- [ ] T009 在 `backend/prisma/schema.prisma` 中将旧 `Order` 模型重命名为 `OrderLegacy`，将 `OrderType` 重命名为 `OrderTypeLegacy`
- [ ] T010 运行 `npx prisma migrate dev --name product_shop_checkout` 生成并应用迁移文件
- [ ] T011 [P] 创建 `backend/src/services/order.service.ts`：实现 `generateOrderNo()` 函数（格式 `ORD-YYYYMMDD-XXXXX`）、订单状态流转校验（`assertCanTransition`）
- [ ] T012 [P] 创建 `backend/src/services/coupon.service.ts`：实现 `validatePromoCoupon(code, productId)`（校验 `PromoCoupon` 有效期、使用次数）和 `applyPromoCoupon(couponId, tx)`（乐观锁消耗次数）；注意 service 内部操作的是 `promoCoupon` 表，不影响积分系统的 `coupon` 表
- [ ] T013 [P] 创建 `backend/src/services/notification.service.ts`：实现 `createOrderNotification(orderId, type)`，写入 `Notification` 表
- [ ] T014 [P] 创建 `backend/src/middleware/adminAuth.ts`（如尚未存在）：管理员权限校验中间件

**Checkpoint**: `prisma studio` 可看到 5 个新表，服务层函数可单独调用

---

## Phase 3: User Story 1 — 浏览并购买商品 (Priority: P1) 🎯 MVP 入口

**Goal**: 已登录用户能看到商品列表，点击进入购买确认页，创建订单。

**Independent Test**: 
1. 管理员先在 DB 中直接插入一条 `Product` 测试数据（或通过后台 API）
2. 用户登录后访问 `/products`，能看到该商品卡片
3. 点击"购买"进入确认页，点击"创建订单"后，数据库中出现 `ProductOrder` 记录（status = CREATED）

### 后端实现（US1）

- [ ] T015 [P] [US1] 创建 `backend/src/routes/products.ts`：`GET /api/products`（列表，仅返回 `isActive=true`，按 `sortOrder` 排序）、`GET /api/products/:id`（详情），需登录鉴权
- [ ] T016 [P] [US1] 创建 `backend/src/routes/orders.ts`（新版）：`POST /api/orders`（创建订单，参数：`productId`、`userNote`？；调用 `order.service.generateOrderNo`；返回订单 ID、订单号、价格）
- [ ] T017 [US1] 在 `backend/src/routes/orders.ts` 中添加：`GET /api/orders/my`（我的订单列表，分页）、`GET /api/orders/my/:id`（订单详情）
- [ ] T018 [US1] 在 `backend/src/app.ts` 注册新路由：`products`、新版 `orders`

### 前台实现（US1）

- [ ] T019 [P] [US1] 创建 `frontend/src/pages/products/index.vue`：展示商品卡片网格（图片、名称、描述、价格、"购买"按钮），调用 `GET /api/products`，未登录跳转到 `/login?redirect=/products`
- [ ] T020 [P] [US1] 创建 `frontend/src/pages/products/detail.vue`：展示商品详情 + 价格汇总区域（暂无优惠码输入，US2 添加）+ "去支付"按钮（调用 `POST /api/orders` 创建订单）
- [ ] T021 [US1] 创建 `frontend/src/pages/orders/index.vue`（新版）：我的订单列表，调用 `GET /api/orders/my`，展示订单号、商品名、金额、状态 Tag
- [ ] T022 [US1] 创建 `frontend/src/pages/orders/detail.vue`（新版）：订单详情页，展示所有字段，当 `status = CREATED` 时显示"去支付"按钮
- [ ] T023 [US1] 更新 `frontend/src/router/index.ts`：添加 `/products`、`/products/:id`、`/orders`、`/orders/:id` 路由，需要登录守卫
- [ ] T024 [US1] 更新 `frontend/src/pages/home/index.vue`：将"立即开始"按钮的跳转地址改为 `/products`
- [ ] T025 [US1] 更新 `frontend/src/App.vue` 底部导航栏：将提交需求入口替换为商品列表入口 `/products`

**Checkpoint**: 完整 US1 可验收——用户登录 → 商品列表 → 购买确认 → 创建订单 → 我的订单列表可见新订单

---

## Phase 4: User Story 3 — 扫码支付并通知管理员 (Priority: P1)

**Goal**: 用户在购买确认页点击"去支付"弹出收款码弹窗，点击"我已支付"后订单变为已支付，管理员收到站内通知。

**Independent Test**:
1. 确认管理员后台已配置收款码图片（`PaymentConfig` 表有数据）
2. 用户在订单详情页点击"去支付"，弹窗显示微信/支付宝收款码和订单号提示
3. 点击"我已支付"，`ProductOrder.status` 变为 `PAID`，`Notification` 表新增一条未读通知

### 后端实现（US3）

- [ ] T026 [P] [US3] 在 `backend/src/routes/orders.ts` 添加：`POST /api/orders/:id/pay`（CREATED→PAID，调用 `notification.service.createOrderNotification`）、`POST /api/orders/:id/cancel`（用户取消，仅 CREATED 状态）
- [ ] T027 [P] [US3] 创建 `backend/src/routes/paymentConfig.ts`：`GET /api/payment-config`（需登录，获取收款码 URL）、`PUT /api/admin/payment-config`（管理员更新，支持图片 URL）
- [ ] T028 [P] [US3] 创建 `backend/src/routes/notifications.ts`：`GET /api/notifications`（管理员，支持 `?unread=true&limit=20`）、`PUT /api/notifications/:id/read`、`PUT /api/notifications/read-all`
- [ ] T029 [P] [US3] 创建 `backend/src/routes/admin/productOrders.ts`（对应实现文件 `admin/productOrders.ts`）：`GET /api/admin/orders`（分页+筛选 status）、`PUT /api/admin/orders/:id/complete`（PAID→COMPLETED）、`PUT /api/admin/orders/:id/cancel`（管理员取消，含 `reason`）；**在 `complete` 接口中承接 Feature 001 积分首购挂钩**：订单变为 COMPLETED 时检查用户是否有 `invitedById`、是否为首笔 `ProductOrder` COMPLETED，若满足则调用 `pointsService.awardPoints(inviterId, 'INVITE_FIRST_ORDER')` + `pointsService.awardPoints(userId, 'NEW_USER_FIRST_ORDER')`（使用 `prisma.productOrder.count` 替代旧版 `prisma.order.count`）
- [ ] T030 [US3] 在 `backend/src/app.ts` 注册新路由：`paymentConfig`、`notifications`、`admin/orders`

### 前台实现（US3）

- [ ] T031 [P] [US3] 创建 `frontend/src/components/PaymentModal.vue`：弹窗组件，`props: { orderId, orderNo, paidPrice }`，调用 `GET /api/payment-config` 展示收款码图片，"我已支付"按钮调用 `POST /api/orders/:id/pay`，成功后 emit `paid` 事件并跳转到订单详情页
- [ ] T032 [US3] 在 `frontend/src/pages/products/detail.vue` 集成 `PaymentModal.vue`：点击"去支付"时先调用 `POST /api/orders`（如尚未创建），然后打开弹窗
- [ ] T033 [US3] 更新 `frontend/src/pages/orders/detail.vue`：当 `status = CREATED` 显示"去支付"按钮触发 `PaymentModal`；当 `status = PAID` 显示"等待管理员核对"提示信息

### 后台实现（US3）

- [ ] T034 [P] [US3] 创建 `admin/src/pages/orders/index.vue`（新版）：订单列表页，支持状态筛选、关键词搜索，操作列含"确认完成"（PAID→COMPLETED）和"取消订单"按钮
- [ ] T035 [P] [US3] 创建 `admin/src/pages/payment-config/index.vue`：收款码配置页，展示当前微信/支付宝收款码图片预览，上传新图片（URL 输入或复用轮播图上传组件）
- [ ] T036 [P] [US3] 创建 `admin/src/components/NotificationBell.vue`：铃铛图标 + 未读角标（`unreadCount`），点击展开最近通知下拉列表，每条通知显示摘要 + 时间 + 跳转到对应订单；挂载时立即请求一次，之后每 30s 轮询 `GET /api/notifications?unread=true&limit=1`；面板关闭时调用 `PUT /api/notifications/read-all`
- [ ] T037 [US3] 将 `NotificationBell.vue` 集成到 `admin/src/layouts/AdminLayout.vue`（或顶部导航栏组件）的右上角
- [ ] T038 [US3] 更新 `admin/src/router/index.ts` 和侧边栏：添加"订单管理"和"收款码配置"菜单项

**Checkpoint**: US3 可验收——用户完成支付弹窗操作后，管理员后台铃铛角标 +1，订单管理页可见 PAID 订单，管理员可点击"确认完成"

---

## Phase 5: User Story 2 — 使用优惠码享受折扣 (Priority: P2)

**Goal**: 用户在购买确认页输入优惠码，系统实时验证并预览折扣后价格；创建订单时后端二次校验。

**Independent Test**:
1. 管理员在 DB 中直接插入一条有效 `Coupon` 测试数据
2. 用户在 `/products/:id` 页面输入该优惠码，点击"验证"，页面显示折扣金额和最终价格
3. 点击"去支付"，`ProductOrder.discountAmount` 和 `paidPrice` 正确记录

### 后端实现（US2）

- [ ] T039 [P] [US2] 创建 `backend/src/routes/coupons.ts`：`POST /api/coupons/validate`（校验 `PromoCoupon` 优惠码+预览价格，不消耗次数）；需登录鉴权
- [ ] T040 [US2] 更新 `backend/src/routes/orders.ts` 中 `POST /api/orders`：接受可选 `couponCode` 参数，在事务内调用 `coupon.service.applyPromoCoupon` 消耗次数（乐观锁），计算 `discountAmount` 和 `paidPrice`

### 前台实现（US2）

- [ ] T041 [P] [US2] 更新 `frontend/src/pages/products/detail.vue`：添加优惠码输入框（`<input>` + "验证"按钮），调用 `POST /api/coupons/validate`，成功后更新价格显示区域（原价划线 + 折扣金额 + 实付价格），失败时显示具体错误提示（已过期/已使用/无效）
- [ ] T042 [US2] 更新 `frontend/src/pages/products/detail.vue` 的订单创建逻辑：将已验证的 `couponCode` 传入 `POST /api/orders` 请求体

**Checkpoint**: US2 可验收——输入有效优惠码后价格实时更新，订单创建后 `ProductOrder.discountAmount > 0`，同一优惠码再次使用时返回"已使用"错误

---

## Phase 6: User Story 4 — 管理员维护商品列表 (Priority: P2)

**Goal**: 管理员可在后台对商品进行完整 CRUD 操作，变更立即反映至前台。

**Independent Test**:
1. 管理员在后台"商品管理"页新增一个商品并保存
2. 立即访问前台 `/products`，可见到新商品
3. 管理员将其设为"下架"，前台列表不再显示

### 后端实现（US4）

- [ ] T043 [P] [US4] 创建 `backend/src/routes/admin/products.ts`：`GET /api/admin/products`（含下架商品，全量）、`POST /api/admin/products`（新增）、`PUT /api/admin/products/:id`（编辑）、`DELETE /api/admin/products/:id`（删除，若有关联订单则返回 400 并提示）、`PUT /api/admin/products/:id/toggle`（切换上下架状态）
- [ ] T044 [US4] 在 `backend/src/app.ts` 注册 `admin/products` 路由

### 后台实现（US4）

- [ ] T045 [P] [US4] 创建 `admin/src/pages/products/index.vue`：商品管理列表页（表格展示：图片缩略图、名称、价格、状态开关、操作按钮），支持新增/编辑（侧边抽屉或弹窗 `el-dialog`）、删除确认、上下架切换
- [ ] T046 [US4] 在"新增/编辑商品"表单中支持图片 URL 输入（复用现有图片上传逻辑，参照 Carousel 管理组件）
- [ ] T047 [US4] 更新 `admin/src/router/index.ts` 和侧边栏：添加"商品管理"菜单项

**Checkpoint**: US4 可验收——管理员新增商品 → 前台 5 秒内可见；编辑价格 → 购买确认页显示新价格；下架 → 前台隐藏

---

## Phase 7: User Story 5 — 管理员制作优惠码 (Priority: P3)

**Goal**: 管理员可在后台生成优惠码，设置折扣值、有效期、使用次数，并可查看使用状态。

**Independent Test**:
1. 管理员在"优惠码管理"页创建一个 8 折、7 天有效、单次使用的优惠码
2. 该优惠码出现在管理列表中，`usedCount = 0`
3. 用户在购买确认页输入该码后，`usedCount` 变为 1，第二次使用时返回"已使用"

### 后端实现（US5）

- [ ] T048 [P] [US5] 创建 `backend/src/routes/admin/promoCoupons.ts`（对应实现文件 `admin/promoCoupons.ts`）：`GET /api/admin/promo-coupons`（列表）、`POST /api/admin/promo-coupons`（创建，自动检查 `code` 唯一性）、`DELETE /api/admin/promo-coupons/:id`（已使用的不允许删除，返回 400）、`PUT /api/admin/promo-coupons/:id/deactivate`（软停用）
- [ ] T049 [US5] 在 `backend/src/app.ts` 注册 `admin/promoCoupons` 路由

### 后台实现（US5）

- [ ] T050 [P] [US5] 创建 `admin/src/pages/coupons/index.vue`：促销优惠码管理页（表格：优惠码、折扣类型/值、有效期、已用/上限、状态）；新增表单（优惠码字符串、折扣类型单选、折扣值、有效期范围 `el-date-picker`、使用次数上限）；支持停用和删除操作；对应后端 `GET /api/admin/promo-coupons`
- [ ] T051 [US5] 更新 `admin/src/router/index.ts` 和侧边栏：添加"促销优惠码"菜单项

**Checkpoint**: US5 可验收——管理员创建优惠码 → 用户在购买页验证成功 → 使用后 `usedCount+1` → 重复使用报错

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 提升整体质量，补全边界逻辑、错误提示和视觉一致性。

- [ ] T052 [P] 为 `backend/src/services/order.service.ts` 编写单元测试：① `assertCanTransition` 校验合法状态流转（CREATED→PAID、PAID→COMPLETED）；② 非法流转（COMPLETED→PAID）抛出异常；③ `generateOrderNo` 生成符合 `ORD-YYYYMMDD-XXXXX` 格式的唯一编号
- [ ] T052b [P] 为 `backend/src/services/coupon.service.ts` 编写单元测试：① `validatePromoCoupon` 对已过期码返回错误；② 对已达使用上限的码返回错误；③ `applyPromoCoupon` 在并发场景下（乐观锁）只允许一次成功消耗
- [ ] T052c [P] 在 `frontend/src/pages/products/index.vue` 添加空状态（无商品时的占位提示）和骨架屏 loading 效果
- [ ] T053 [P] 在 `frontend/src/pages/orders/index.vue` 添加订单状态的彩色 Tag（已创建-灰、已支付-蓝、已完成-绿、已取消-红）和空状态提示
- [ ] T054 [P] 在 `admin/src/pages/orders/index.vue` 添加批量筛选、导出（可选）和分页
- [ ] T055 [P] 前台 `frontend/src/App.vue` 底部导航栏：将"提交"按钮改为"商品"入口（指向 `/products`）
- [ ] T056 [P] 后台 `admin/src/pages/payment-config/index.vue`：添加收款码图片实时预览（输入 URL 后即时渲染）
- [ ] T057 全局错误处理：在 `frontend/src/api/index.ts` 的请求拦截器中统一处理 `COUPON_INVALID`、`ORDER_STATUS_INVALID`、`PRODUCT_NOT_FOUND` 等业务错误码，显示友好 Toast
- [ ] T058 [P] 后端所有新路由添加结构化日志（`fastify.log.info`）：订单创建、状态变更、优惠码使用
- [ ] T059 [P] 更新 `frontend/src/router/index.ts`：`/` 首页的"立即开始"跳转目标已在 T024 中修改，验证无 dead link
- [ ] T060 [P] 运行 `npx prisma generate` 确认类型正确，修复所有 TypeScript 编译错误
- [ ] T061 [P] 构建验证：`pnpm -r build` 确保 backend/frontend/admin 全部无报错构建
- [ ] T062 参照 `deploy/` 目录更新部署文档，添加新环境变量说明（若有），确认 Nginx 配置无需修改

---

## Dependencies & Execution Order

### Phase 依赖关系

```
Phase 1 (Cleanup)
    │
    ▼
Phase 2 (Foundation: DB + Services)  ← BLOCKS all stories
    │
    ├──▶ Phase 3 (US1: 浏览商品/创建订单)  ← MVP 核心
    │        │
    │        ▼
    │   Phase 4 (US3: 支付弹窗/通知)  ← 依赖 US1 的订单创建
    │        │
    │        ▼
    │   Phase 5 (US2: 优惠码)  ← 依赖 US1 购买确认页
    │
    ├──▶ Phase 6 (US4: 管理员商品管理)  ← 可与 US1 并行
    │
    └──▶ Phase 7 (US5: 管理员优惠码)  ← 可与 US4 并行
             │
             ▼
        Phase 8 (Polish)
```

### User Story 依赖矩阵

| Story | 依赖 | 可否并行 |
|-------|------|----------|
| US1 (P1) | Phase 2 完成 | 可在 Phase 2 后立即开始 |
| US3 (P1) | US1 后端 T015-T017 完成 | 后台 T034-T036 可与 US1 并行 |
| US2 (P2) | US1 前台 T019-T020 完成 | T039 后端可与 US3 并行 |
| US4 (P2) | Phase 2 完成 | 全程可与 US1/US3 并行 |
| US5 (P3) | Phase 2 完成 | 全程可与其他 Story 并行 |

---

## Parallel Opportunities

### Phase 2 内并行（T011-T014）

```
并行执行:
├── T011: order.service.ts（订单逻辑）
├── T012: coupon.service.ts（优惠码逻辑）
└── T013: notification.service.ts（通知逻辑）
```

### Phase 3 内并行（US1）

```
并行执行:
├── 后端: T015 (products 路由) + T016-T017 (orders 路由)
└── 前台: T019 (商品列表页) + T020 (商品详情页) + T021 (订单列表) + T022 (订单详情)
```

### Phase 4 内并行（US3）

```
并行执行:
├── 后端: T026 (订单支付/取消) + T027 (收款码) + T028 (通知) + T029 (admin/orders)
├── 前台: T031 (PaymentModal 组件)
└── 后台: T034 (订单管理页) + T035 (收款码配置页) + T036 (NotificationBell)
```

---

## Implementation Strategy

### MVP Scope（最小可验收版本）

完成以下即可上线核心购买流程：

1. Phase 1 清理旧代码
2. Phase 2 数据库迁移
3. Phase 3 (US1) 商品浏览 + 创建订单
4. Phase 4 (US3) 支付弹窗 + 管理员通知

**MVP 不包括**：优惠码（US2）、管理员商品管理页（US4，可直接 DB 操作替代）、优惠码管理（US5）

### 推荐迭代顺序

| 迭代 | 内容 | 价值 |
|------|------|------|
| Sprint 1 | Phase 1 + Phase 2 + Phase 3 (US1) | 用户可以看商品、创建订单 |
| Sprint 2 | Phase 4 (US3) + Phase 6 (US4) | 完整支付流程 + 管理员可维护商品 |
| Sprint 3 | Phase 5 (US2) + Phase 7 (US5) | 优惠码促销体系 |
| Sprint 4 | Phase 8 (Polish) | 质量与体验完善 |

---

## Notes

- `[P]` = 可并行任务（操作不同文件，无未完成前置依赖）
- `[USx]` = 对应 spec.md 中的 User Story 编号
- Phase 1 执行前**必须**备份生产数据库
- 每完成一个 Checkpoint 后，建议 `git commit` 一次，便于回滚
- 新增路由后需重启 PM2：`pm2 restart backend`
- 数据库迁移后需重新生成 Prisma 客户端：`npx prisma generate`
