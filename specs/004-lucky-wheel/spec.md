# Feature Specification: 幸运转盘

**Feature Branch**: `004-lucky-wheel`
**Created**: 2026-05-06
**Status**: Draft

---

## 一、概述

在用户端新增「幸运转盘」功能，新注册用户获得 1 次免费抽奖机会，每成功邀请 1 位好友可额外获得 1 次，上限 3 次。转盘奖品为作业折扣券/现金抵扣，抽中后自动发放到积分/优惠券账户。

---

## 二、奖品配置

| 扇区 | 奖品 | 数量 | 类型 | 效果 |
|------|------|------|------|------|
| 1 | 🏆 28.88元现金大奖 | 1 份 | 兑换码 | 生成兑换码，联系管理员换取现金 |
| 2 | 🎯 谢谢惠顾 | 无限 | 无 | 无 |
| 3 | 📝 小作业折扣券 | 20 份 | 折扣券 | 小作业类订单9折，自动发放 |
| 4 | 🎯 谢谢惠顾 | 无限 | 无 | 无 |
| 5 | 📚 期末作业折扣券 | 5 份 | 折扣券 | 期末作业类订单85折，自动发放 |
| 6 | 🎯 谢谢惠顾 | 无限 | 无 | 无 |
| 7 | 🎟️ 7折券 | 10 份 | 折扣券 | 全品类订单7折，自动发放 |
| 8 | 🎁 五折券 | 3 份 | 折扣券 | 全品类订单5折，自动发放 |

> 奖品发完后自动替换为「谢谢惠顾」。概率由后端控制，前端仅做动画展示。
> 现金类奖品中奖后生成唯一兑换码，用户联系管理员凭码兑换现金。

---

## 三、页面设计

### 3.1 转盘页面布局 `/lucky-wheel`

```
┌─────────────────────────────────────────────┐
│  ← 返回                        剩余次数: 1  │
│                                              │
│          🎰 幸运转盘                          │
│      邀请好友越多，机会越多！                    │
│                                              │
│         ┌─────────────────┐                  │
│         │   ╱  88元  ╲     │                  │
│        ╱ 谢谢   │   28元  ╲  │                │
│       │  惠顾  ─┼─  抵扣   │ │                │
│       │       ╱ ╲         │ │                │
│        ╲ 期末 │ │ 小作业 ╱  │                 │
│         │ 作业 │ │ 折扣  │  │                  │
│         └──────┼──────────┘                  │
│                ▼  (指针)                      │
│                                              │
│         ┌──────────────┐                     │
│         │   🎯 开始抽奖  │  ← 金色按钮        │
│         └──────────────┘                     │
│                                              │
│  ── 中奖记录 ──────────────────               │
│  📋 暂无中奖记录                               │
│                                              │
│  ── 活动规则 ──────────────────               │
│  · 新用户注册即送 1 次抽奖机会                  │
│  · 每成功邀请 1 位好友 +1 次                    │
│  · 最多可获得 3 次抽奖机会                      │
│  · 奖品自动发放至账户                          │
└─────────────────────────────────────────────┘
```

### 3.2 转盘视觉设计

8 个扇区，交替配色：

```
扇区配色方案（深色背景下的转盘）：
┌──────────┬──────────┐
│  扇区 1   │  扇区 2   │
│ #FF6B6B  │ #2D3748  │
│ (珊瑚红)  │ (深灰)    │
├──────────┼──────────┤
│  扇区 3   │  扇区 4   │
│ #4ECDC4  │ #2D3748  │
│ (青绿)    │ (深灰)    │
├──────────┼──────────┤
│  扇区 5   │  扇区 6   │
│ #45B7D1  │ #2D3748  │
│ (天蓝)    │ (深灰)    │
├──────────┼──────────┤
│  扇区 7   │  扇区 8   │
│ #96CEB4  │ #2D3748  │
│ (薄荷绿)  │ (深灰)    │
└──────────┴──────────┘

中心圆：渐变金色 #FFD700 → #FFA500
指针：三角形，白色带阴影
外圈：金属质感渐变边框
```

### 3.3 中奖弹窗

```
┌──────────────────────────────┐
│                              │
│         🎉 恭喜中奖！         │
│                              │
│      ┌──────────────────┐    │
│      │  🏆 88元现金抵扣   │    │
│      │  已发放到您的账户   │    │
│      └──────────────────┘    │
│                              │
│      可在「我的订单」提交      │
│      需求时自动抵扣            │
│                              │
│      ┌──────────────┐        │
│      │   好的，知道了  │        │
│      └──────────────┘        │
└──────────────────────────────┘

未中奖弹窗：
┌──────────────────────────────┐
│                              │
│         😢 很遗憾             │
│                              │
│       谢谢惠顾                │
│       下次一定中！             │
│                              │
│    剩余抽奖次数: 2            │
│                              │
│      ┌──────────────┐        │
│      │   再试一次     │        │
│      └──────────────┘        │
└──────────────────────────────┘
```

### 3.4 入口位置

1. **首页 Hero 区域**：新增一个「🎰 幸运转盘」按钮（在 CTA 按钮旁边）
2. **个人中心**：新增「幸运转盘」快捷入口卡片
3. **导航栏**（登录后）：可选，用小红点提示有可用次数

---

## 四、数据模型

### 4.1 新增 Prisma Model

```prisma
// 转盘奖品配置
model WheelPrize {
  id          String   @id @default(cuid())
  label       String          // 奖品名称
  type        PrizeType       // 奖品类型
  value       Decimal? @db.Decimal(10, 2)  // 金额/折扣比例
  totalStock  Int             // 总库存 (-1 = 无限)
  remainStock Int             // 剩余库存
  color       String          // 扇区颜色
  icon        String          // emoji 图标
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)

  createdAt   DateTime @default(now())

  spinResults SpinResult[]

  @@map("wheel_prizes")
}

enum PrizeType {
  CASH_REDEEM     // 现金兑换码（联系管理员）
  ORDER_DISCOUNT  // 订单折扣券（自动发放）
  NONE            // 谢谢惠顾
}

// 用户抽奖记录
model SpinResult {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  prizeId     String
  prize       WheelPrize @relation(fields: [prizeId], references: [id])
  spinRound   Int          // 第几次抽奖 (1/2/3)
  redeemCode  String?      // 现金类奖品的兑换码（唯一）
  isRedeemed  Boolean  @default(false)  // 是否已兑换

  createdAt   DateTime @default(now())

  @@unique([userId, spinRound])
  @@unique([redeemCode])    // 兑换码唯一
  @@index([userId])
  @@map("spin_results")
}

// 活动浮窗配置（单例）
model ActivityPopup {
  id          String   @id @default("singleton")
  enabled     Boolean  @default(false)
  title       String   @default("🎰 幸运转盘 限时活动")
  description String   @default("新用户注册送1次抽奖机会")
  buttonText  String   @default("✨ 立即抽奖 ✨")
  linkUrl     String   @default("/lucky-wheel")
  imageUrl    String?
  showCondition String  @default("all")  // all / new_user / has_spins

  updatedAt   DateTime @updatedAt

  @@map("activity_popup")
}
```

### 4.2 User 模型扩展

```prisma
model User {
  // ... 现有字段 ...
  spinResults SpinResult[]
}
```

---

## 五、API 设计

### 5.1 用户端

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/lucky-wheel/info` | 获取转盘信息：奖品列表、剩余次数、中奖记录 |
| POST | `/lucky-wheel/spin` | 执行抽奖（原子操作，防并发） |

#### `GET /lucky-wheel/info`

```json
{
  "prizes": [
    { "id": "...", "label": "88元现金抵扣", "icon": "🏆", "color": "#FF6B6B", "type": "CASH_DISCOUNT" },
    { "id": "...", "label": "谢谢惠顾", "icon": "🎯", "color": "#2D3748", "type": "NONE" }
    // ...
  ],
  "remainingSpins": 2,
  "maxSpins": 3,
  "history": [
    { "prizeLabel": "小作业折扣券", "won": true, "createdAt": "2026-05-06T..." }
  ]
}
```

#### `POST /lucky-wheel/spin`

```json
// Response
{
  "prizeIndex": 3,        // 中奖扇区索引 (0-7)
  "prize": {
    "id": "...",
    "label": "28元现金奖",
    "type": "CASH_REDEEM",
    "value": 28.00
  },
  "won": true,
  "redeemCode": "JW-88A3F2",  // 仅现金类奖品有此字段
  "remainingSpins": 1
}
```

### 5.2 管理端 - 转盘管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/wheel/prizes` | 奖品列表 |
| PUT | `/admin/wheel/prizes/:id` | 修改奖品（库存、状态） |
| GET | `/admin/wheel/results` | 抽奖记录列表（分页，含兑换码） |
| POST | `/admin/wheel/redeem/:id` | 核销兑换码（确认现金已发放） |
| GET | `/admin/wheel/stats` | 统计：总抽奖次数、中奖率、各奖品发放数 |

### 5.3 管理端 - 活动浮窗

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/activity-popup` | 获取浮窗配置 |
| PUT | `/admin/activity-popup` | 更新浮窗配置 |
| GET | `/api/activity-popup` | 用户端获取浮窗配置（公开） |

---

## 六、业务逻辑

### 6.1 抽奖次数计算

```
剩余次数 = 注册赠送(1) + 邀请成功数(min(邀请人数, 2)) - 已用次数
         = min(1 + 邀请成功数, 3) - 已用次数
```

- 注册即送 1 次
- 每邀请 1 位好友（完成注册）+1 次
- 上限 3 次
- 已用次数 = `spin_results` 表中该用户的记录数

### 6.2 抽奖算法（后端）

```typescript
async function spin(userId: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. 检查剩余次数
    const spinCount = await tx.spinResult.count({ where: { userId } })
    const inviteCount = await tx.user.count({ where: { invitedById: userId } })
    const maxSpins = Math.min(1 + inviteCount, 3)
    if (spinCount >= maxSpins) throw new Error('NO_SPINS_LEFT')

    // 2. 加权随机选择奖品（考虑库存）
    const prizes = await tx.wheelPrize.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    })
    const winner = weightedRandom(prizes)

    // 3. 扣减库存
    if (winner.totalStock !== -1) {
      await tx.wheelPrize.update({
        where: { id: winner.id },
        data: { remainStock: { decrement: 1 } }
      })
    }

    // 4. 生成兑换码（现金类奖品）
    let redeemCode: string | null = null
    if (winner.type === 'CASH_REDEEM') {
      redeemCode = generateRedeemCode()  // 如: JW-88A3F2
    }

    // 5. 记录抽奖结果
    await tx.spinResult.create({
      data: { userId, prizeId: winner.id, spinRound: spinCount + 1, redeemCode }
    })

    // 6. 折扣券类奖品自动发放
    if (winner.type === 'ORDER_DISCOUNT' && winner.value) {
      await createDiscountCoupon(tx, userId, winner.value)
    }

    return {
      prize: winner,
      won: winner.type !== 'NONE',
      redeemCode,  // 现金类返回兑换码
    }
  })
}
```
```

### 6.3 前端动画

```
1. 用户点击「开始抽奖」
2. 前端调用 POST /lucky-wheel/spin 获取结果
3. 根据返回的 prizeIndex 计算目标角度
4. CSS transition: transform rotate(目标角度 + 多圈)
5. 动画结束后展示中奖弹窗
```

---

## 七、页面入口设计

### 7.1 首页入口

在首页顶部区域新增转盘入口按钮（赛博朋克风格，带霓虹光效）。

### 7.2 首页浮窗活动弹窗

用户首次访问（或有可用抽奖次数时）自动弹出浮窗：

```
┌──────────────────────────────────────────┐
│  ✕                                        │
│                                           │
│     ╔═══════════════════════════╗         │
│     ║   🎰 幸运转盘 限时活动     ║         │
│     ╚═══════════════════════════╝         │
│                                           │
│     ┌─────────────────────────┐           │
│     │    转盘预览图 (缩小版)    │           │
│     └─────────────────────────┘           │
│                                           │
│     🎁 新用户注册送 1 次抽奖               │
│     🎁 邀请好友最多获得 3 次               │
│                                           │
│     ┌───────────────────────┐             │
│     │   ✨ 立即抽奖 ✨        │             │
│     └───────────────────────┘             │
│                                           │
│     [今日不再显示]                          │
└──────────────────────────────────────────┘
```

**后台控制**：
- 管理端可配置浮窗的标题、描述、图片、按钮文案
- 可控制浮窗开关（是否显示）
- 可设置显示条件（仅新用户 / 有次数用户 / 全部用户）
- 用户可勾选「今日不再显示」

### 7.3 管理端 - 活动浮窗管理

管理端新增「活动浮窗」配置页面：

```
┌──────────────────────────────────────────┐
│  活动浮窗管理                    [保存]    │
│                                          │
│  启用浮窗: [✓]                            │
│                                          │
│  标题: [🎰 幸运转盘 限时活动    ]          │
│  描述: [新用户注册送1次抽奖机会  ]          │
│  按钮文案: [✨ 立即抽奖 ✨     ]           │
│  跳转链接: [/lucky-wheel      ]          │
│  图片URL:  [https://...       ]          │
│                                          │
│  显示条件:                                │
│  ○ 所有用户                                │
│  ○ 仅新用户（注册7天内）                    │
│  ○ 有可用抽奖次数的用户                     │
└──────────────────────────────────────────┘
```

---

## 八、边缘情况

- **并发抽奖**：使用数据库事务 + 唯一约束防止同一轮重复抽奖
- **奖品库存耗尽**：自动降级为「谢谢惠顾」
- **邀请数变化**：实时计算，不缓存
- **未登录访问**：跳转登录页，登录后返回转盘
- **移动端适配**：转盘居中，按钮放大，弹窗全屏

---

## 九、技术栈

- **前端**：Vue 3 + CSS conic-gradient 生成转盘 + CSS animation 旋转
- **后端**：Fastify + Prisma 事务
- **数据库**：PostgreSQL（新增 2 张表）
- **无需第三方转盘库**：纯 CSS + JS 实现
