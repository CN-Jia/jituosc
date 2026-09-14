# 极拓空间 · 作业/毕设需求对接平台

作业/毕设需求对接与进度追踪系统。用户提交需求 → 管理员接单处理 → 全流程状态跟踪 + 积分激励 + 商品/转盘营销体系。

> 本仓库为 `ai-jituo` 的后端重构版本：借鉴 [ruoyi-vue-pro（芋道）](https://github.com/YunaiV/ruoyi-vue-pro) 的工程化思想，**保留 Node.js 技术栈不变**，重构为「业务域模块化 + 分层清晰 + 统一错误处理」的架构。详见 [`docs/refactor-plan.md`](docs/refactor-plan.md) 与 [`REFACTOR_LOG.md`](REFACTOR_LOG.md)。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 用户端 | Vue 3 + Vite + TypeScript + Pinia（PC/移动端响应式） |
| 管理端 | Vue 3 + Element Plus + ECharts |
| 后端 | Node.js + Fastify + TypeScript + Zod |
| 数据库 | PostgreSQL + Prisma ORM（25 个模型） |
| 部署 | PM2 + Nginx / Docker |

## 架构说明

后端采用**按业务域模块化 + 分层**的架构（借鉴芋道 `yudao-module-*` 与 `controller/service/dal/convert` 分层，翻译到 Node/Fastify 生态）：

- **framework/** —— 框架层：统一响应、错误码、全局异常处理
- **modules/** —— 业务模块（按领域拆分，每模块内 `route → service → repository` 分层）
- **config / lib / middlewares / plugins / utils** —— 配置、DB 单例、鉴权、插件、工具

```
backend/src/
├── app.ts                    # 入口：插件装配 + 模块路由注册 + 全局错误处理
├── framework/
│   ├── errors.ts             # HttpError + 错误码→HTTP状态码映射
│   └── response.ts           # 统一响应 + 错误码枚举
├── config/env.ts             # 环境变量（Zod 校验）
├── lib/prisma.ts             # Prisma 单例
├── middlewares/              # verifyJWT / verifyAdmin / 限流
├── plugins/                  # cors / jwt / multipart
├── modules/                  # 业务模块
│   ├── system/               # 认证、用户管理、系统监控
│   ├── order/                # 需求订单（完整分层样板）
│   ├── points/               # 积分体系、积分商城
│   ├── product/              # 商品、商品订单、优惠码、收款码
│   ├── forum/                # 论坛帖子、评论
│   ├── content/              # 活动公告、作品轮播、用户反馈
│   └── marketing/            # 幸运转盘、活动浮窗
└── utils/                    # 共享工具（状态机、订单号、日期等）
```

### 分层职责

| 层 | 职责 |
|----|------|
| `*.routes.ts` | 薄路由：Zod 校验 → 调 service → 统一响应 |
| `*.service.ts` | 业务逻辑、事务编排 |
| `*.repository.ts` | Prisma 数据访问（含 VO select 白名单） |

---

## 功能模块

### 用户端

| 模块 | 说明 |
|------|------|
| 首页 | Hero 动画、功能介绍、历代作品轮播、价格表 |
| 提交需求 | 填写课程/类型/年级/截止日期，支持积分折扣 |
| 我的订单 | 需求订单列表，点击查看详情和状态流转 |
| 积分中心 / 商城 | 积分明细、兑换记录、优惠券、服务套餐 |
| 邀请好友 | 专属邀请码，双向积分奖励 |
| 论坛 | 多板块帖子，Markdown 支持，评论互动 |
| 活动公告 | 系统公告和优惠活动 |
| 幸运转盘 | 抽奖、兑换码核销 |

### 管理后台

| 模块 | 说明 |
|------|------|
| 监控大屏 | 今日/本周/累计订单、状态分布、系统资源 |
| 订单管理 | 需求订单列表、状态变更、报价、备注 |
| 需求类型 | 管理需求分类和参考价格 |
| 商品/商品订单 | 商品 CRUD、订单完成/取消、优惠码 |
| 积分管理 | 积分规则、用户积分、商城商品、兑换审核 |
| 论坛/活动/轮播/反馈 | 内容审核与管理 |
| 转盘管理 | 奖品配置、抽奖记录、核销、统计 |
| 用户管理 | 搜索、启用/禁用 |

### 订单状态机

```
CREATED → PENDING → IN_PROGRESS → COMPLETED
             └──────────┴──────────┘ → CANCELLED
```

---

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8（本仓库使用 pnpm 12，`allowBuilds` 配置见 `pnpm-workspace.yaml`）
- PostgreSQL >= 14

### 安装

```bash
git clone https://github.com/CN-Jia/jituosc.git
cd jituosc
pnpm install
pnpm --filter backend db:generate   # 生成 Prisma Client
```

### 配置

```bash
cp backend/.env.example backend/.env
# 编辑 .env 填入数据库连接、JWT 密钥、管理员账号等
```

### 初始化数据库

```bash
pnpm --filter backend db:push      # 同步 schema
pnpm --filter backend db:seed      # 种子数据（如有）
```

### 开发启动

```bash
pnpm dev:backend                          # 后端 → http://localhost:3000
pnpm --filter jituo-frontend dev          # 用户端 → http://localhost:5175
pnpm --filter admin dev                   # 管理端 → http://localhost:5174
```

### 构建 & 部署

```bash
pnpm build:backend                        # tsc → backend/dist/
pnpm build:admin                          # vite build → admin/dist/
pm2 start ecosystem.config.js
# 或使用 Docker：docker compose -f docker-compose.prod.yml up -d
```

---

## 环境变量

见 `backend/.env.example`，关键项：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 |
| `JWT_SECRET` | JWT 签名密钥（≥16 字符） |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` | 管理员账号（bcrypt 哈希） |
| `SERVERCHAN_TOKEN` | Server酱推送（可选） |
| `RESEND_API_KEY` | 邮件服务（可选，未配置时控制台打印验证码） |

## 测试

```bash
pnpm test              # vitest 单元测试
pnpm test:coverage     # 含覆盖率
```

## License

Private — All rights reserved.
