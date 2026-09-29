# Data Model: 商品列表与订单结算流程

**Feature**: 002-product-shop-checkout  
**Date**: 2026-04-29

---

## Prisma Schema 变更摘要

### 新增模型

#### Product（商品）

```prisma
model Product {
  id          String   @id @default(cuid())
  name        String
  description String?  @db.Text
  imageUrl    String?
  price       Decimal  @db.Decimal(10, 2)
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  orders      ProductOrder[]
}
```

**字段说明**：
- `price`: 原价，展示价格，Decimal 类型避免浮点误差
- `isActive`: 管理员下架不影响历史订单
- `sortOrder`: 管理员可调整展示排序

---

#### ProductOrder（新版订单）

```prisma
enum OrderStatus {
  CREATED    // 已创建
  PAID       // 已支付（用户自报）
  COMPLETED  // 已完成（管理员确认）
  CANCELLED  // 已取消
}

model ProductOrder {
  id            String      @id @default(cuid())
  orderNo       String      @unique  // ORD-YYYYMMDD-XXXXX
  userId        String
  productId     String
  couponId      String?     // 可选
  originalPrice Decimal     @db.Decimal(10, 2)
  discountAmount Decimal    @db.Decimal(10, 2) @default(0)
  paidPrice     Decimal     @db.Decimal(10, 2)
  status        OrderStatus @default(CREATED)
  cancelReason  String?
  userNote      String?     @db.Text  // 用户备注（需求说明）
  paidAt        DateTime?
  completedAt   DateTime?
  cancelledAt   DateTime?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  user    User     @relation(fields: [userId], references: [id])
  product Product  @relation(fields: [productId], references: [id])
  coupon  Coupon?  @relation(fields: [couponId], references: [id])
  notifications Notification[]
}
```

**状态流转规则**：
- `CREATED → PAID`：仅用户本人操作，且订单须为 CREATED 状态
- `PAID → COMPLETED`：仅管理员操作
- `CREATED/PAID → CANCELLED`：管理员可取消；用户只能取消 CREATED 状态订单

---

#### Coupon（优惠码）

```prisma
enum DiscountType {
  FIXED      // 固定金额折扣（元）
  PERCENTAGE // 百分比折扣（0-100）
}

model Coupon {
  id           String       @id @default(cuid())
  code         String       @unique
  discountType DiscountType
  discountValue Decimal     @db.Decimal(10, 2)  // 元 或 百分比数值
  validFrom    DateTime
  validTo      DateTime
  maxUses      Int          @default(1)
  usedCount    Int          @default(0)
  version      Int          @default(0)  // 乐观锁
  isActive     Boolean      @default(true)
  createdAt    DateTime     @default(now())
  orders       ProductOrder[]
}
```

**校验规则**：
- `now() >= validFrom && now() <= validTo`：有效期
- `usedCount < maxUses`：使用次数未超限
- `isActive = true`：未被手动停用

---

#### PaymentConfig（收款码配置）

```prisma
model PaymentConfig {
  id         String   @id @default("singleton")  // 单例记录
  wechatUrl  String?  // 微信收款码图片 URL
  alipayUrl  String?  // 支付宝收款码图片 URL
  updatedAt  DateTime @updatedAt
}
```

---

#### Notification（站内通知）

```prisma
enum NotificationType {
  ORDER_PAID      // 用户标记已支付
  ORDER_COMPLETED // 订单完成
  ORDER_CANCELLED // 订单取消
}

model Notification {
  id        String           @id @default(cuid())
  type      NotificationType
  summary   String           // 通知摘要文本
  orderId   String?
  isRead    Boolean          @default(false)
  createdAt DateTime         @default(now())

  order ProductOrder? @relation(fields: [orderId], references: [id])
}
```

---

### 旧模型处理

| 旧模型 | 处理方式 | 说明 |
|--------|----------|------|
| `Order`（旧版） | 重命名为 `OrderLegacy` | 保留历史数据 |
| `OrderType` | 重命名为 `OrderTypeLegacy` | 保留历史数据 |

---

## 实体关系图（ERD）

```
User ──────────────────────────── ProductOrder
 │                                    │       │
 │                              Product    Coupon
 │                                    │
 │                              Notification
 │
PaymentConfig（单例）
```

**关键约束**：
- 一个用户可有多个订单（1:N）
- 一个商品可被多次购买（1:N）
- 一个优惠码可被多个订单使用，但受 `maxUses` 控制
- `Notification` 与 `ProductOrder` 是可选关联

---

## 迁移文件命名建议

```
migrations/
└── 20260429_001_product_shop_checkout/
    ├── migration.sql   # Prisma auto-generated
    └── notes.md        # 手工记录：旧表重命名、数据保留说明
```
