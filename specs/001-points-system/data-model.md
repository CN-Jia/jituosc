# Data Model: 积分系统

**Branch**: `001-points-system` | **Date**: 2026-04-28

## 新增/修改模型

### 修改 User（新增字段）

```prisma
model User {
  // ... 现有字段 ...
  inviteCode    String?   @unique          // 用户专属邀请码（注册时自动生成）
  invitedById   String?                   // 邀请者 userId（注册时携带 ref 参数）
  invitedBy     User?     @relation("Invitations", fields: [invitedById], references: [id])
  invitees      User[]    @relation("Invitations") // 我邀请的人

  pointBalance  PointBalance?
  pointLogs     PointLog[]
  redeemOrders  RedeemOrder[]
  coupons       Coupon[]
}
```

---

### PointBalance（积分余额）

```prisma
model PointBalance {
  id           String @id @default(cuid())
  userId       String @unique
  user         User   @relation(fields: [userId], references: [id])
  totalPoints  Int    @default(0)   // 当前可用积分（不含冻结）
  frozenPoints Int    @default(0)   // 冻结中积分（待审核兑换）
  lifetimeEarned Int  @default(0)   // 历史总获得（统计用）

  updatedAt DateTime @updatedAt

  @@map("point_balances")
}
```

---

### PointLog（积分明细）

```prisma
model PointLog {
  id        String         @id @default(cuid())
  userId    String
  user      User           @relation(fields: [userId], references: [id])
  eventType PointEventType
  delta     Int            // 正数=获得，负数=消费/冻结
  balance   Int            // 变动后余额快照
  remark    String?        // 备注（如"邀请用户 xxx 注册"）
  refId     String?        // 关联对象 id（如 redeemOrderId、orderId）

  createdAt DateTime @default(now())

  @@index([userId, createdAt])
  @@map("point_logs")
}

enum PointEventType {
  INVITE_REGISTER        // 邀请注册奖励（邀请者获得）
  INVITE_FIRST_ORDER     // 被邀请者首购奖励（邀请者获得）
  NEW_USER_FIRST_ORDER   // 新用户首购奖励（新用户自己获得）
  ADMIN_ADJUST           // 管理员手动调整
  REDEEM_FREEZE          // 兑换冻结（临时，等审核）
  REDEEM_DEDUCT          // 兑换扣减（审核通过）
  REDEEM_UNFREEZE        // 兑换解冻（审核拒绝归还）
}
```

---

### PointRule（积分规则配置）

```prisma
model PointRule {
  id        String         @id @default(cuid())
  eventType PointEventType @unique
  points    Int            // 该事件奖励/扣减的积分值（正整数）
  enabled   Boolean        @default(true)
  remark    String?

  updatedAt DateTime @updatedAt

  @@map("point_rules")
}
```

---

### ShopItem（积分商城商品）

```prisma
model ShopItem {
  id          String       @id @default(cuid())
  name        String
  description String?      @db.Text
  coverUrl    String?
  type        ShopItemType
  pointsCost  Int          // 所需积分
  stock       Int          @default(-1)   // -1=无限库存
  discountAmt Decimal?     @db.Decimal(10,2)  // 折扣券类型：抵扣金额
  isActive    Boolean      @default(true)
  sortOrder   Int          @default(0)

  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  redeemOrders RedeemOrder[]

  @@map("shop_items")
}

enum ShopItemType {
  SERVICE   // 固定套餐（直接兑换服务）
  COUPON    // 折扣券
}
```

---

### RedeemOrder（兑换订单）

```prisma
model RedeemOrder {
  id          String        @id @default(cuid())
  userId      String
  user        User          @relation(fields: [userId], references: [id])
  shopItemId  String
  shopItem    ShopItem      @relation(fields: [shopItemId], references: [id])
  pointsCost  Int           // 兑换时积分单价快照
  status      RedeemStatus  @default(PENDING)
  adminNote   String?       // 管理员审核备注

  coupon      Coupon?       // 若为折扣券类型，审核通过后生成

  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([userId, createdAt])
  @@index([status])
  @@map("redeem_orders")
}

enum RedeemStatus {
  PENDING    // 待审核（积分已冻结）
  COMPLETED  // 已完成（积分已扣减）
  REJECTED   // 已拒绝（积分已解冻）
}
```

---

### Coupon（折扣券）

```prisma
model Coupon {
  id           String       @id @default(cuid())
  code         String       @unique  // 8位唯一优惠码
  userId       String
  user         User         @relation(fields: [userId], references: [id])
  redeemOrderId String      @unique
  redeemOrder  RedeemOrder  @relation(fields: [redeemOrderId], references: [id])
  discountAmt  Decimal      @db.Decimal(10,2)
  status       CouponStatus @default(UNUSED)
  expiresAt    DateTime     // 默认兑换后 90 天

  usedAt       DateTime?

  @@index([userId])
  @@map("coupons")
}

enum CouponStatus {
  UNUSED
  USED
  EXPIRED
}
```

---

## 关系图

```
User ──1:1──► PointBalance
User ──1:N──► PointLog
User ──1:N──► RedeemOrder ──N:1──► ShopItem
User ──1:N──► Coupon ──1:1──► RedeemOrder
User ──自关联── User (invitedBy / invitees)
PointRule ──独立配置表── (eventType唯一)
```

## 数据约束

| 字段 | 约束 |
|------|------|
| `PointBalance.totalPoints` | `>= 0`，服务层保证，不依赖 DB 约束 |
| `PointBalance.frozenPoints` | `>= 0` |
| `ShopItem.stock` | `-1` 表示无限，`>= 0` 时检查库存 |
| `RedeemOrder.pointsCost` | 创建时从 `ShopItem.pointsCost` 快照，防止改价影响历史 |
| `User.inviteCode` | 6 位大写字母+数字，唯一索引 |
