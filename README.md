# 极拓空间 · 作业/毕设需求对接平台

[![CI](https://github.com/CN-Jia/jituosc/actions/workflows/ci.yml/badge.svg)](https://github.com/CN-Jia/jituosc/actions/workflows/ci.yml)

作业/毕设需求对接与进度追踪系统：用户提交需求 → 管理员接单处理 → 全流程状态跟踪，配套积分激励、商品与优惠券、论坛、活动营销和毕设进度查询。

除业务功能外，本仓库还完整包含**部署与运维链路**：Docker 容器化、GitHub Actions CI/CD、GHCR 镜像、Nginx HTTPS、PostgreSQL 备份、健康检查与监控大屏 —— 见 [运维能力](#运维能力)。

---

## 目录

- [项目简介](#项目简介)
- [技术栈](#技术栈)
- [系统架构](#系统架构)
- [功能模块](#功能模块)
- [工程结构](#工程结构)
- [本地开发](#本地开发)
- [部署](#部署)
- [运维能力](#运维能力)
- [环境变量](#环境变量)
- [测试](#测试)
- [分支策略与 CI/CD](#分支策略与-cicd)
- [已知不足与后续计划](#已知不足与后续计划)

---

## 项目简介

面向高校学生与接单方的需求对接平台，覆盖「需求提交 → 报价接单 → 进度跟踪 → 完成交付」全流程，并用积分体系、优惠券与活动提升留存。

- **用户端**：提交需求、查看订单与进度、积分中心与商城、邀请好友、论坛、幸运转盘、毕设进度查询
- **管理端**：监控大屏、订单与需求类型管理、商品/优惠券、积分规则与兑换审核、内容审核、转盘管理、毕设进度维护

<!-- TODO(截图)：部署后在此补充两张图 —— 用户端首页 + 管理端监控大屏，例如
![用户端首页](docs/images/home.png)
![监控大屏](docs/images/dashboard.png)
（当前仓库内尚无截图资源，故未放置图片链接以免出现死链） -->

## 技术栈

| 层级 | 技术 |
|---|---|
| 用户端 | Vue 3 · Vite · TypeScript · Pinia · Vue Router |
| 管理端 | Vue 3 · Element Plus · ECharts |
| 后端 | Node.js 20 · Fastify 4 · TypeScript · Zod |
| 数据 | PostgreSQL 16 · Prisma ORM（30 个模型，含迁移文件） |
| 部署 | Docker Compose · Nginx（HTTPS/反代）· PM2（备用方案） |
| CI/CD | GitHub Actions · GHCR（GitHub Container Registry） |
| 可观测 | 后端 `/metrics`（prom-client）· Prometheus + Grafana + node_exporter（配置纳管，见 `deploy/monitoring/`）· `/health` 健康检查 |

## 系统架构

**运行时**

```
                 ┌──────────────────────────────────────────┐
   浏览器 ──────► │ Nginx（容器）                             │
                 │  /            → 用户端静态文件             │
                 │  /admin/      → 管理端静态文件             │
                 │  /uploads/    → 反代后端（^~ 前缀，见下）   │
                 │  /health      → 反代后端（精确匹配）        │
                 │  /api/        → 反代后端                  │
                 └───────────────────┬──────────────────────┘
                                     ▼
                          ┌─────────────────────┐
                          │ Backend（Fastify）   │
                          │ 插件 → 限流 → 鉴权   │
                          │ → 路由 → service     │
                          │ → repository → Prisma│
                          └──────────┬──────────┘
                                     ▼
                            PostgreSQL 16（宿主机）
```

**部署拓扑**

```
        GitHub (master)
              │  CI：测试 + 类型检查
              ▼
      GitHub Actions ──(tag v* / 手动)──► 测试门禁
              │                                │
              │ 构建并推送镜像                  ▼
              └────────────────────────► GHCR（backend / nginx）
                                               │
                                               ▼
                                  ┌────────────────────────┐
                                  │ 云服务器（Ubuntu）       │
                                  │ docker compose pull/up │
                                  │ prisma migrate deploy  │
                                  │ 健康检查（校验响应体）    │
                                  └────────────────────────┘
```

## 功能模块

**用户端**

| 模块 | 说明 |
|---|---|
| 首页 | Hero 动画、功能介绍、历代作品轮播、价格表 |
| 提交需求 | 课程/类型/年级/截止日期，支持积分与优惠券折扣 |
| 我的订单 | 订单列表、详情与状态流转 |
| 积分中心 / 商城 | 积分明细、兑换记录、优惠券、服务套餐 |
| 邀请好友 | 专属邀请码，双向积分奖励 |
| 论坛 | 多板块帖子、Markdown、评论互动（需审核） |
| 活动 / 幸运转盘 | 活动公告、抽奖与兑换码核销 |
| 毕设进度查询 | 题目 + 6 位验证码查询进度与截图 |

**管理端**

| 模块 | 说明 |
|---|---|
| 监控大屏 | 订单统计 + 宿主机资源（CPU/内存/磁盘/负载/网络，支持 24h・7 天时序） |
| 订单 / 需求类型 | 状态变更、报价、备注、分类与参考价 |
| 商品 / 商品订单 / 优惠码 | CRUD、完成与取消、优惠码管理 |
| 积分管理 | 规则、用户积分、商城商品、兑换审核 |
| 内容管理 | 论坛、活动、轮播、用户反馈审核 |
| 转盘管理 | 奖品配置、抽奖记录、核销、统计 |
| 毕设进度 | 题目、进度记录、进度截图、活动、站点漂浮字 |

**订单状态机**

```
CREATED → PENDING → IN_PROGRESS → COMPLETED
             └──────────┴──────────┘ → CANCELLED
```

## 工程结构

```
jituosc/
├── frontend/                     # 用户端（Vue 3 + Vite）
├── admin/                        # 管理端（Vue 3 + Element Plus，base=/admin/）
├── backend/
│   ├── src/
│   │   ├── app.ts                # 入口：插件装配 + 模块路由注册 + 全局错误处理
│   │   ├── framework/            # 统一响应、错误码、HttpError、DTO 校验助手
│   │   ├── config/env.ts         # 环境变量（Zod 校验，启动即失败）
│   │   ├── lib/prisma.ts         # Prisma 单例
│   │   ├── middlewares/          # verifyJWT / verifyAdmin / 限流
│   │   ├── plugins/              # cors / jwt / multipart / static(/uploads/)
│   │   ├── shared/storage/       # 上传路径约定 + 图片校验与落盘
│   │   └── modules/              # 按业务域划分（见下）
│   ├── prisma/                   # schema 与 migrations
│   └── tests/                    # 单元测试 + 集成测试
├── deploy/
│   ├── DEPLOY.md                 # 备用方案（PM2 + 宿主机 Nginx）完整步骤
│   ├── ecosystem.config.js       # PM2 配置（备用方案）
│   ├── backup.sh                 # PostgreSQL 备份脚本
│   ├── nginx-docker.conf         # 容器内 Nginx
│   ├── nginx/jituo.conf          # 宿主机 Nginx（备用方案）
│   └── monitoring/               # 监控栈（Prometheus / Grafana / node_exporter，配置与仪表盘纳管）
├── docs/cloudops-roadmap.md      # 部署与运维改造路线图（含已完成的整改记录）
├── .github/workflows/            # ci.yml（测试/类型检查）、deploy.yml（构建部署）
├── docker-compose.prod.yml       # ★ 生产部署入口
└── docker-compose.dev.yml        # 本地起后端 + PostgreSQL
```

**后端分层**

请求链路：`Route（鉴权 + DTO 校验）→ Service（业务）→ Repository（Prisma）→ PostgreSQL`，出参统一经 VO 裁剪。

| 模块 | 分层现状 |
|---|---|
| `order` | 完整：routes / service / repository / notify（含状态机与积分联动） |
| `thesis` | 完整：routes / service / repository / dto / vo / types |
| `system` `points` `product` | routes / service（repository 层待补） |
| `forum` `content` `marketing` | 目前路由层直连 Prisma，待按上述模式补齐 |

> 分层带来的直接收益：业务规则可脱离数据库单测 —— 见 `backend/tests/unit/`。

## 本地开发

**环境要求**：Node.js ≥ 20 · pnpm 12 · PostgreSQL ≥ 14（或使用 `docker-compose.dev.yml` 起的 PG）

```bash
git clone https://github.com/CN-Jia/jituosc.git
cd jituosc
pnpm install
pnpm db:generate                 # 生成 Prisma Client
cp backend/.env.example backend/.env   # 填入 DATABASE_URL / JWT_SECRET / 管理员账号
pnpm db:migrate                  # 应用迁移（或 pnpm --filter backend exec prisma migrate deploy）
pnpm db:seed                     # 可选：种子数据
```

**启动三端**（全部在仓库根执行）

```bash
pnpm dev:backend                 # 后端 → http://localhost:3000
pnpm dev:frontend                # 用户端 → http://localhost:5175
pnpm dev:admin                   # 管理端 → http://localhost:5174/admin/
```

两个前端的 Vite 都已把 `/api`、`/uploads` 代理到 `localhost:3000`，本地无需额外配置。

**只想跑容器化的后端 + 数据库**

```bash
docker compose -f docker-compose.dev.yml up    # backend（tsx 热重载）+ postgres
```

## 部署

两条部署路径，**生产环境使用 Docker Compose**；PM2 是项目早期方案，降级为「不使用容器时的备用方案」保留。

| 方式 | 定位 | 说明 |
|---|---|---|
| **Docker Compose** | 生产（推荐） | Nginx 与 Backend 均以容器运行，镜像由 GitHub Actions 构建并推送到 GHCR |
| **PM2 + 宿主机 Nginx** | 备用 | 传统 Node.js 部署；完整步骤见 [`deploy/DEPLOY.md`](deploy/DEPLOY.md) |

> ⚠️ 两套方式都会占用 **80 / 443 / 3000** 端口，**同时只能启用一套**。切换前先停掉另一套：
> `docker compose -f docker-compose.prod.yml down` 或 `pm2 delete jituo-api`。

**生产：Docker Compose**

CD 流程（[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)）：
推送 tag（`v*`）或手动触发 → **测试门禁** → 构建 backend / nginx 镜像并推 GHCR → SSH 到服务器拉取并重启 → `prisma migrate deploy` → 健康检查（校验响应体）。

日常提交到 `master` 只跑 CI（测试 + 类型检查），不会触碰生产。

服务器上手动执行等价于：

```bash
cd /var/www/jituo
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans
docker compose -f docker-compose.prod.yml exec -T backend \
  pnpm --filter backend exec prisma migrate deploy   # 在容器内用 workspace 执行，才能命中 backend/prisma
```

**备用：PM2 + 宿主机 Nginx**

```bash
pnpm install && pnpm build:backend         # PM2 的 script 指向 backend/dist/app.js
pm2 start deploy/ecosystem.config.js --env production   # env_production 必须带 --env
pm2 save
sudo nginx -t && sudo systemctl reload nginx            # 配置见 deploy/nginx/jituo.conf
```

## 运维能力

### 健康检查

- 后端 `GET /health` 返回 `{ ok, timestamp, uptime }`（不查库，用于存活探测）
- Docker 镜像内置 `HEALTHCHECK`；Nginx 两套配置都用**精确匹配** `location = /health` 反代到后端
- CD 的健康检查**校验响应体**而非仅看 HTTP 200 —— 否则 `/health` 一旦被前端 SPA 回退接管，后端挂掉也会返回 200，检查就形同虚设；同时带 10 次重试避免容器刚启动误判

### 文件上传安全

图片上传走统一校验层（`backend/src/shared/storage/image-upload.ts`）：

| 项 | 做法 |
|---|---|
| 类型 | **魔数嗅探**（PNG / JPEG / WEBP），只信文件内容，不信 `filename` 与 `Content-Type`；改名的伪装文件直接拒 |
| 大小 | 单图 5MB：解析层 `req.file({ limits })` 先卡（超限即中断，不把大文件收进内存）+ 存储层复查；全局兜底 10MB，Nginx 侧 12m |
| 文件名 | 落盘名 = `nanoid(24)` + 由魔数推导的扩展名，用户原始名不进磁盘路径；展示名另行清理 |
| 落盘 | 先写 `.tmp` 再原子改名；落库失败时回滚已落盘文件 |
| 访问 | 后端 `/uploads/` 静态服务（禁目录列表）；Nginx 用 `location ^~ /uploads/` 反代，`^~` 用于避免被静态资源正则 location 抢占 |

### 数据备份

`deploy/backup.sh`：`pg_dump` → `gzip` → 本地保留最近 7 天，建议 crontab `0 3 * * *`。

### 监控

**应用指标**：后端 `/metrics` 暴露 Prometheus 格式指标（prom-client）

| 指标 | 用途 |
|---|---|
| `http_requests_total{method,route,status}` | 请求量、状态码分布；**按路由模板聚合**，避免随机 URL 打爆标签基数（未匹配记为 `unmatched`） |
| `http_request_duration_seconds{...}` | 响应时间直方图 → P95 / P99 |
| `http_requests_in_flight` | 正在处理的请求数 |
| `process_*` / `nodejs_*` | Node 进程 CPU、内存、Event Loop 延迟、GC、句柄数 |

`/metrics` 不对外暴露：后端端口只绑 `127.0.0.1`，且 Nginx 对该路径显式返回 404。

**监控栈**（`deploy/monitoring/`，配置与仪表盘全部纳入版本管理）

```
Prometheus（抓 127.0.0.1:3000/metrics 与 127.0.0.1:9100）
   └── Grafana：仪表盘「极拓空间 · 总览」（QPS、5xx 占比、P95/P99、进程内存、Event Loop、宿主机资源、抓取状态）
   └── node_exporter：宿主机 CPU / 内存 / 磁盘 / 网络 / 负载
   └── 告警规则：后端掉线、5xx>5%、P95>1s、Event Loop>0.5s、磁盘>85%、内存>90%、负载过高
```

一键启动与面板说明见 [`deploy/monitoring/README.md`](deploy/monitoring/README.md)（含为什么 Prometheus 用 host 网络的取舍说明）。

**管理端监控大屏**：订单统计 + 宿主机资源，经 Prometheus HTTP API（`PROMETHEUS_URL`）查询，支持 24h / 7 天时序；Prometheus 不可用时回落到 `node:os` 实时数据。

### 日志与资源限制

- 生产容器 `json-file` 日志驱动 + 轮转（`max-size` / `max-file`），限制内存并在超限时重启
- 后端统一日志（pino），全局错误处理器区分 4xx/5xx 并只对 5xx 记录错误栈

### 安全基线

- 全部接口经 Zod 校验；统一响应体，错误码枚举集中管理
- JWT 鉴权（用户 / 管理员分离），订单提交限流，bcrypt 存密码
- Nginx 安全响应头（HSTS / X-Frame-Options / X-Content-Type-Options 等）与 TLS 1.2+ 配置
- 密钥与 `.env` 不入库（`.gitignore` + `.dockerignore` 双重保障）

## 环境变量

复制 `backend/.env.example` 为 `backend/.env`，启动时由 `backend/src/config/env.ts` 用 Zod 校验，缺失或非法直接退出。

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接串（必填） |
| `JWT_SECRET` | JWT 签名密钥，≥16 字符（必填） |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` | 管理员账号（bcrypt 哈希，必填；启动时会校验哈希格式） |
| `PORT` / `NODE_ENV` / `APP_BASE_URL` | 运行配置 |
| `UPLOAD_DIR` | 上传目录（默认 `uploads`；容器内需由 compose 指定为卷路径） |
| `SERVERCHAN_TOKEN` | Server酱推送（可选，新订单微信通知） |
| `RESEND_API_KEY` / `MAIL_FROM` | 邮件服务（可选，未配置时验证码打印到控制台） |
| `ADMIN_WECHAT_ID` | 展示给用户的联系微信号 |
| `PROMETHEUS_URL` | 监控大屏的数据源（默认 `http://localhost:9090`） |

> ⚠️ **用 Docker Compose 部署时，bcrypt 哈希里的每个 `$` 都要写成 `$$`。**
> Compose 会对 `env_file` 的值做变量插值，`$2b$10$xxxx` 会被替换成 `$2b$10`（只留一条 warning），
> 结果是"服务起来了、管理员却永远登不上"。写成 `$$2b$$10$$xxxx` 即可；
> 后端会把 `$$` 还原成 `$`，所以同一份 `.env` 在 PM2/dotenv 路径下也能直接用。
> 哈希格式非法时**启动即失败**，不会留下这种静默故障。

## 测试

```bash
pnpm test                        # 全部测试（55 个）
pnpm test:coverage               # 含覆盖率
```

| 测试 | 内容 |
|---|---|
| `tests/unit/order-status.test.ts` | 订单状态机合法/非法流转 |
| `tests/unit/thesis.test.ts` | thesis DTO 边界、VO 裁剪（含「公开视图不泄露验证码」） |
| `tests/unit/image-upload.test.ts` | 魔数嗅探、伪装文件拒绝、大小限制、展示名清理 |
| `tests/integration/thesis-upload.test.ts` | 上传接口全链路（`app.inject` + mock Prisma，无需数据库） |
| `tests/integration/metrics.test.ts` | `/metrics` 指标采集、路由标签基数受控、抓取自身不计入 |

## 分支策略与 CI/CD

- 生产分支为 **`master`**；`ci.yml` 在 push / PR 到 `master` 时运行**测试 + 后端类型检查 + 前端 vue-tsc**
- `deploy.yml` 仅在**推送 tag（`v*`）或手动触发**时执行，且以 `test` job 作为门禁，测试不过不发布
- 部署任务带并发保护（同一时间只允许一次生产部署），并以 `environment: production` 标记
- 镜像同时打 `latest`、提交 SHA 与 tag 三个标签，便于回滚到指定版本

发布一次：

```bash
git tag v1.0.0 && git push origin v1.0.0
```

## 已知不足与后续计划

诚实记录当前没做的部分（详见 [`docs/cloudops-roadmap.md`](docs/cloudops-roadmap.md)）：

- **分层推进中**：`forum` / `content` / `marketing` 仍是路由层直连 Prisma；`system` / `points` / `product` 缺 repository 层
- **备份未闭环**：`backup.sh` 只备份到本机，未上传 OSS（同一台机器磁盘损坏即同时丢失），也还没有 `restore.sh` 与恢复演练
- **告警未通知**：Prometheus 规则已定义，但未接 Alertmanager，触发后不会主动推送
- **图片存本地盘**：未接对象存储（`ali-oss` 依赖已在，接入点是 `saveImageUpload()`）
- **数据库跑在宿主机**：未容器化，跨机迁移需手工处理
- **未使用 Redis**：当前业务没有必须的缓存/会话/限流场景，不做无业务支撑的技术堆砌
- **Kubernetes**：仅作为实验性实践，不替换生产（单机 Compose 更稳、更好维护）

## License

Private — All rights reserved.
