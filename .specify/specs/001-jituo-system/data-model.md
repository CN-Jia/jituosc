# Data Model: 极拓空间 数据库设计 v4

**Branch**: `001-jituo-system` | **Updated**: 2026-04-28 v4（新增完整注册登录、论坛、轮播模型）

---

## Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==================== 用户 ====================
model User {
  id            String    @id @default(cuid())
  username      String    @unique          // 登录用户名（字母数字下划线，4-20位）
  nickname      String                     // 显示昵称
  email         String    @unique          // 登录邮箱（已验证）
  emailVerified Boolean   @default(false)  // 邮箱是否已验证
  passwordHash  String                     // bcrypt 密码哈希
  phone         String?                    // 手机号
  wechatId      String?                    // 微信号（提交订单默认带入）
  grade         Grade?                     // 年级
  isActive      Boolean   @default(true)   // 是否被禁用
  loginAttempts Int       @default(0)      // 连续登录失败次数
  lockUntil     DateTime?                  // 账户锁定截止时间

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  orders        Order[]
  comments      Comment[]
  feedbacks     Feedback[]
  notifications Notification[]

  @@map("users")
}

// ==================== 邮箱验证码 ====================
model EmailVerification {
  id        String   @id @default(cuid())
  email     String
  code      String                       // 6位数字验证码
  expiresAt DateTime                     // 过期时间（5分钟）
  usedAt    DateTime?                    // 使用时间（null=未使用）

  createdAt DateTime @default(now())

  @@index([email, code])
  @@map("email_verifications")
}

// ==================== 需求类型 ====================
model OrderType {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  price       String
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  orders      Order[]

  @@map("order_types")
}

// ==================== 活动/公告 ====================
model Activity {
  id        String       @id @default(cuid())
  title     String
  content   String       @db.Text
  type      ActivityType
  startAt   DateTime
  endAt     DateTime?
  isActive  Boolean      @default(true)

  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  @@index([isActive, startAt])
  @@map("activities")
}

enum ActivityType {
  PROMO
  NOTICE
}

// ==================== 订单 ====================
model Order {
  id             String      @id @default(cuid())
  orderNo        String      @unique
  courseName     String
  grade          Grade

  orderTypeId    String
  orderType      OrderType   @relation(fields: [orderTypeId], references: [id])

  deadline       DateTime
  contactWechat  String

  status         OrderStatus @default(PENDING)
  source         OrderSource @default(PC)

  userId         String?
  user           User?       @relation(fields: [userId], references: [id])

  adminNote      String?     @db.Text
  quotedPrice    String?

  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  statusHistory  StatusHistory[]
  notifications  Notification[]

  @@index([status])
  @@index([createdAt])
  @@index([userId])
  @@map("orders")
}

enum Grade {
  FRESHMAN   // 大一
  SOPHOMORE  // 大二
  JUNIOR     // 大三
}

enum OrderStatus {
  PENDING
  ACCEPTED
  IN_PROGRESS
  COMPLETED
  CLOSED
}

enum OrderSource {
  MINIPROGRAM  // 历史兼容
  PC
}

// ==================== 状态历史 ====================
model StatusHistory {
  id         String      @id @default(cuid())
  orderId    String
  order      Order       @relation(fields: [orderId], references: [id])
  fromStatus OrderStatus?
  toStatus   OrderStatus
  operator   String
  remark     String?
  createdAt  DateTime    @default(now())

  @@index([orderId])
  @@map("order_status_history")
}

// ==================== 论坛帖子 ====================
model Post {
  id          String      @id @default(cuid())
  title       String
  summary     String?                      // 摘要（列表页展示）
  content     String      @db.Text         // 正文（Markdown）
  cover       String?                      // 封面图 URL
  type        PostType    @default(DISCUSSION)
  status      PostStatus  @default(PENDING) // 用户帖需审核
  authorId    String?                      // null = 管理员发布

  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  comments    Comment[]

  @@index([status, createdAt])
  @@map("posts")
}

enum PostType {
  ANNOUNCEMENT  // 管理员公告（直接发布）
  DISCUSSION    // 用户讨论（需审核）
}

enum PostStatus {
  PENDING    // 待审核
  APPROVED   // 已发布
  REJECTED   // 已拒绝
}

// ==================== 用户反馈 ====================
model Feedback {
  id          String         @id @default(cuid())
  userId      String
  user        User           @relation(fields: [userId], references: [id])
  type        FeedbackType
  title       String
  description String         @db.Text
  status      FeedbackStatus @default(PENDING)
  adminReply  String?        @db.Text       // 管理员回复内容
  repliedAt   DateTime?                     // 回复时间

  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@index([userId, createdAt])
  @@index([status])
  @@map("feedbacks")
}

enum FeedbackType {
  BUG         // 问题反馈
  SUGGESTION  // 改进建议
  OTHER       // 其他
}

enum FeedbackStatus {
  PENDING    // 待处理
  REPLIED    // 已回复
  RESOLVED   // 已解决
}

// ==================== 评论 ====================
model Comment {
  id        String   @id @default(cuid())
  postId    String
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  content   String   @db.Text
  isHidden  Boolean  @default(false)     // 管理员可隐藏

  createdAt DateTime @default(now())

  @@index([postId, createdAt])
  @@map("comments")
}

// ==================== 历代作品轮播 ====================
model Carousel {
  id          String   @id @default(cuid())
  imageUrl    String                     // 图片外链 URL
  courseName  String                     // 课程名称
  orderType   String                     // 需求类型文字（冗余存储）
  completedAt DateTime                   // 完成时间
  review      String?                    // 好评语
  orderNoMask String?                    // 脱敏订单号，如 JT-****-A3F2
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("carousels")
}

// ==================== 通知日志 ====================
model Notification {
  id        String        @id @default(cuid())
  orderId   String
  order     Order         @relation(fields: [orderId], references: [id])
  userId    String?
  user      User?         @relation(fields: [userId], references: [id])
  channel   NotifyChannel
  type      NotifyType
  status    NotifyStatus
  error     String?

  createdAt DateTime      @default(now())

  @@index([orderId])
  @@map("notifications")
}

enum NotifyChannel {
  SERVERCHAN
  WECOM
}

enum NotifyType {
  NEW_ORDER
  STATUS_CHANGE
}

enum NotifyStatus {
  SUCCESS
  FAILED
  SKIPPED
}
```

---

## 实体关系图（ERD）

```
users ─────────────────► orders ──── order_status_history (1:N)
  │                         │
  │                         └────── notifications (1:N)
  │
  ├──► comments ──► posts (N:1)
  │
  └──► feedbacks（私密，用户只见自己的）

order_types ──► orders (1:N)
activities（独立）
carousels（独立）
email_verifications（独立）
```

---

## 变更说明（v3 → v4）

| 变更 | 说明 |
|---|---|
| **重构** `User` | 新增 username/passwordHash/nickname/phone/wechatId/grade/emailVerified/loginAttempts/lockUntil |
| **新增** `EmailVerification` | 注册邮箱验证码记录 |
| **新增** `Post` | 论坛文章（管理员发布） |
| **新增** `Comment` | 用户对文章的评论 |
| **新增** `Carousel` | 历代完成作品轮播条目 |
| 移除微信 openid 直接登录 | 改为 username/email + password |

---

## 状态机约束

```typescript
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING:     ['ACCEPTED', 'CLOSED'],
  ACCEPTED:    ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['COMPLETED', 'CLOSED'],
  COMPLETED:   ['CLOSED'],
  CLOSED:      [],
}
```

---

## 年级枚举映射

```typescript
const GRADE_LABEL: Record<Grade, string> = {
  FRESHMAN:  '大一',
  SOPHOMORE: '大二',
  JUNIOR:    '大三',
}
```

---

## 索引策略

- `users.username` / `users.email` — 登录查询
- `orders.status` / `orders.createdAt` / `orders.userId` — 订单筛选
- `posts.isPublished + createdAt` — 论坛列表
- `comments.postId + createdAt` — 评论列表
- `email_verifications.email + code` — 验证码查找
- `carousels.isActive + sortOrder` — 轮播排序
