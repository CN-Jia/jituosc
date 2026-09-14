# Implementation Plan: 极拓空间 v2

**Branch**: `001-jituo-system` | **Updated**: 2026-04-23 v3（移除微信小程序端）  
**Spec**: `specs/001-jituo-system/spec.md`

---

## Summary

构建 极拓空间 系统：后端 RESTful API + PC 用户端 + 管理后台，移除微信小程序、文件上传、短链接、邮件通知等功能。

---

## Technical Context

**Backend**: Node.js 20 LTS + Fastify 4.x + Prisma ORM + PostgreSQL  
**PC Web**: Vue 3 + Vite + Pinia + Vue Router（单页应用）  
**Admin**: Vue 3 + Vite + Element Plus + Pinia + Vue Router  
**Push**: Server酱（管理员微信推送）  
**Deploy**: 阿里云 ECS Ubuntu + Nginx + Let's Encrypt SSL  

---

## Project Structure

```text
ai-jituo/
├── backend/                          # Node.js + Fastify API
│   ├── prisma/
│   │   ├── schema.prisma             # 数据库模型
│   │   ├── migrations/               # 迁移文件
│   │   └── seed.ts                   # 初始种子数据（默认类型）
│   └── src/
│       ├── config/env.ts             # 环境变量校验
│       ├── plugins/                  # jwt, cors
│       ├── routes/
│       │   ├── auth.ts               # 登录接口（输入微信号）
│       │   ├── orders.ts             # 订单接口（用户侧）
│       │   └── admin/
│       │       ├── orders.ts         # 订单管理（管理员）+ 统计
│       │       ├── order-types.ts    # 类型管理（管理员）
│       │       └── activities.ts     # 活动管理（管理员）
│       ├── services/
│       │   ├── order.service.ts      # 订单业务逻辑（含统计）
│       │   ├── notify.service.ts     # Server酱推送
│       │   ├── auth.service.ts       # 管理员认证
│       │   └── wechat.service.ts     # 微信登录（开发模式兜底）
│       ├── middlewares/
│       │   ├── auth.middleware.ts    # JWT 鉴权
│       │   └── ratelimit.middleware.ts
│       └── utils/
│           ├── order-id.ts           # 订单号生成 JT-YYYYMMDD-XXXX
│           └── response.ts           # 统一响应格式
│
├── frontend/                         # PC 网页端（Vue 3 + Vite）
│   └── src/
│       ├── pages/
│       │   ├── home/index.vue        # 首页（活动+价格表+入口，60s轮询）
│       │   ├── activity/index.vue    # 活动公告页（60s轮询）
│       │   ├── submit/index.vue      # 提交需求（支持typeId预选）
│       │   ├── result/index.vue      # 提交成功
│       │   ├── my-orders/index.vue   # 我的订单列表
│       │   └── order-detail/index.vue # 订单详情+时间线
│       ├── api/index.ts              # axios 封装
│       ├── store/user.ts             # 用户状态（Pinia）
│       └── router/index.ts           # 路由配置
│
└── admin/                            # 管理后台（Vue 3 + Element Plus）
    └── src/
        ├── pages/
        │   ├── login/index.vue        # 登录
        │   ├── dashboard/index.vue    # 统计首页（今日/本周+最近订单）
        │   ├── orders/index.vue       # 订单列表（状态汇总条+筛选）
        │   ├── order-detail/index.vue # 订单详情（改状态/报价/备注）
        │   ├── order-types/index.vue  # 需求类型管理
        │   └── activities/index.vue   # 活动管理
        ├── api/index.ts
        └── router/index.ts
```

---

## 实现阶段

### Phase 1 — 后端数据库

1. `prisma/schema.prisma`（OrderType / Activity / Order / StatusHistory / Notification）
2. 运行迁移 `prisma migrate dev`
3. 种子数据 `seed.ts`（3种默认类型）

### Phase 2 — 后端 API

1. `auth.ts`（微信号登录 + 管理员登录）
2. `orders.ts`（创建订单、我的订单列表、订单详情含statusHistory）
3. `admin/orders.ts`（列表含stats汇总、详情、改状态、报价、备注、统计接口）
4. `admin/order-types.ts` / `admin/activities.ts`（CRUD）
5. `notify.service.ts`（Server酱推送）
6. 限流中间件注册（POST /api/orders）

### Phase 3 — 管理后台

1. Dashboard（今日/本周统计卡 + 各状态分布 + 最近5条订单）
2. 订单列表（状态汇总条可点击快速筛选 + 关键词搜索 + 分页）
3. 订单详情（改状态/报价/备注/时间线）
4. 需求类型 CRUD
5. 活动 CRUD

### Phase 4 — PC 网页端

1. 首页（活动+价格表点击预选+60s轮询）
2. 活动公告页（已结束标签/剩余天数/60s轮询）
3. 提交需求（typeId预选参数）
4. 提交成功、我的订单、订单详情（statusHistory时间线）
5. 微信号登录弹窗

### Phase 5 — 部署

1. Nginx（`/api` → backend:3000，`/admin` → admin dist，`/` → frontend dist）
2. Let's Encrypt SSL
3. 生产环境 `.env`，`prisma migrate deploy`
4. PM2 进程守护

---

## 环境变量清单

```env
# 数据库
DATABASE_URL="postgresql://postgres:password@localhost:5433/jituo_dev"

# JWT
JWT_SECRET="your-long-random-secret"
JWT_EXPIRES_IN="7d"

# Server酱（管理员推送）
SERVERCHAN_TOKEN="SCT_your_token"

# 管理员账号
ADMIN_USERNAME="admin"
ADMIN_PASSWORD_HASH="bcrypt_hash_of_password"

# 管理员微信号（展示给用户）
ADMIN_WECHAT_ID="Jt--04"

# 应用配置
NODE_ENV="development"
PORT="3000"
```
