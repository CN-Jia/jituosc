# 极拓空间 · 云运维 / DevOps 作品改造路线图

> **目标**：把现在的「能运行的全栈项目」升级为
> **业务平台 + 容器化部署 + CI/CD + 监控 + 备份 + OSS + 基础云原生实践**。
>
> **原则**：不改业务模型、不动前端契约，只补工程化与运维链路；按 **P0 → P1 → P2** 推进。
> 本文档是唯一执行清单，完成一项勾一项。

---

## 0. 现状核对（本仓库实测结论）

计划里的假设已逐条在代码里核对，结论如下（含证据位置）：

| # | 计划中的判断 | 实测结论 | 证据 |
|---|---|---|---|
| 1 | CI/CD 触发分支可能写的是 `main`，实际分支是 `master` | ✅ **确认有问题**：本地 HEAD 指向 `refs/heads/master`，而两个 workflow 都只监听 `main` → **推送到 master 目前不会触发任何 workflow** | `.git/HEAD`；`.github/workflows/ci.yml:4-5`；`.github/workflows/deploy.yml:4-5` |
| 2 | Docker Compose 生产链路需要整理 | ✅ **链路已经完整**：构建 backend + nginx 镜像 → 推 GHCR → SSH 到服务器 → `docker compose pull/up -d` → `prisma migrate deploy` → 健康检查 → 清理旧镜像 | `.github/workflows/deploy.yml`、`docker-compose.prod.yml` |
| 3 | PM2 与 Docker 两套运行方式并存 | ✅ 确认并存，且**曾有两份冲突的 PM2 配置**（根目录 1 实例 fork `400M` vs `deploy/` 2 实例 cluster `512M`）。**已处理**：删除根目录那份，统一保留 `deploy/ecosystem.config.js` | `docker-compose.prod.yml:16`、`deploy/ecosystem.config.js` |
| 4 | Thesis 模块分层不规范 | ✅ 确认；**已修复**（见下方 P0-3 记录）：补齐 repository / dto / vo / types，并把路由层清空为薄层 | `backend/src/modules/thesis/`、`backend/src/modules/order/order.repository.ts` |
| 5 | 图片上传需要安全校验 | ✅ 确认偏弱：全局 multipart 上限 **100MB**（远宽于 5MB），上传路由用 `path.extname(data.filename)` 拼文件名直接落盘，**无 MIME / 类型白名单**，数据库还存了用户原始文件名 | `backend/src/plugins/multipart.ts:5-10`、`backend/src/modules/thesis/thesis.admin.routes.ts:108-122` |
| 6 | 上传走本地 `uploads/`，未接 OSS | ✅ 确认未接入代码：**`ali-oss@^6.20.0` 已在 `backend/package.json` 依赖里，但源码中没有任何 import/使用**（即依赖已备好、功能未实现）；生产用 volume `./backend/uploads:/app/backend/uploads` 持久化 —— 而该挂载路径**与容器内实际写入路径不一致**，见下方修复记录 | `backend/package.json:23`；`docker-compose.prod.yml:38` |
| 7 | 需要检查 Nginx 的 `/uploads/` 访问链路 | ⚠️ **根因比 Nginx 更深**：后端**根本没有注册静态文件服务**（无 `@fastify/static`、`app.ts` 无 static 插件），数据库里存的 `/uploads/xxx.png` 无人提供；Nginx 两个配置也都没有 `/uploads/` location，且正则 location `~* \.(png\|jpg\|…)$` 优先级高于前缀 location → 双重 404。**已修复** | `backend/src/app.ts`（修复前）；`deploy/nginx-docker.conf`、`deploy/nginx/jituo.conf` |
| 8 | 缺少自动化测试 | ✅ 确认：全后端只有 **1 个**测试文件 | `backend/tests/unit/order-status.test.ts` |
| 9 | 没有基础设施监控 | ✅ 确认：无 `prom-client`、无 `/metrics`、无 `deploy/monitoring/` | 全仓库检索无匹配 |
| 10 | 需要做数据库自动备份 | 🟡 **已有一半**：`deploy/backup.sh` 已实现 `pg_dump \| gzip` + 保留 7 天 + crontab 建议（`0 3 * * *`）；**缺 OSS 上传、缺 `restore.sh`** | `deploy/backup.sh` |

> **推论**：这个项目不是"从零开始做运维"，而是"把已有的一半补齐 + 修掉一个真实故障点 + 加上可展示的监控/备份闭环"。
> 所以工作量比预想小，P0 里真正吃时间的是 **Thesis 分层** 和 **上传改造**。

### 已完成的仓库整理（历史重写为单一初始提交）

| 动作 | 对象 |
|---|---|
| 删除 | 根目录重复的 `ecosystem.config.js`（与 `deploy/` 那份冲突） |
| 删除 | 内部日志：`REFACTOR_LOG.md`、`docs/refactor-plan.md`、`CLAUDE.md` |
| 取消跟踪 | `.claude/settings.local.json`（并加入 `.gitignore`） |
| 删除 | `webdrop-源码/`（与 `webdrop/` 逐字节等价，仅换行符不同）、`docs/Typora_Hook_Log.txt` |
| 删除 | 构建产物 `backend/dist`、`frontend/dist`、`admin/dist`（随时可 `pnpm build` 重建） |
| 修正 | `README.md` 失效链接与 PM2 路径、`deploy/DEPLOY.md` 的 PM2 配置路径、`backend/src/app.ts` 注释 |
| 保留 | `webdrop/` 模块、spec-kit 脚手架（`.specify/`、`specs/`、`.github/agents|prompts/`） |

> 整理前的内容已备份到仓库外的 `Desktop\jthub-cleanup-backup-<时间戳>\`。
> GitHub 侧重写为单一初始提交 `a05a59a`（force push）；旧提交对象在一段时间内仍可通过 SHA 访问，彻底清除需删除仓库重建。

### 已完成修复记录（P0-1、P0-5）

**P0-1 CI/CD 触发分支**

| 项 | 处理 |
|---|---|
| `ci.yml` | 触发条件由 `pull_request: [main]` 改为 `push/pull_request: [master]`（推 master 终于会跑流水线） |
| `deploy.yml` | 由 `push: [main]` 改为 **`push: tags: v*` + 手动触发**，日常提交不再触碰生产 |
| 部署门禁 | `deploy.yml` 新增 `test` job，`build-and-deploy` 通过 `needs: test` 依赖它 —— 测试不通过就不发布 |
| 并发保护 | 新增 `concurrency: deploy-production`（`cancel-in-progress: false`），避免两次发布互相覆盖 |
| 权限 | 显式声明 `permissions: packages: write`（推 GHCR 必需），并加 `environment: production` |
| 镜像 tag | 除 `latest`、`<sha>` 外增加 `${{ github.ref_name }}`（tag 名），便于回滚到指定版本 |

**P0-5 `/uploads/` 链路** —— 排查中发现的问题比原判更严重，共 4 个缺陷：

1. **后端没有静态服务（根因）**：`app.ts` 只注册了 cors/jwt/multipart，数据库里存的 `/uploads/xxx.png` 无任何服务提供。
   → 新增 `backend/src/plugins/static.ts`，把 `UPLOAD_DIR` 挂到 `/uploads/`（`list: false` 禁目录列表）。
2. **写入路径与读取路径各写各的**：上传路由硬编码 `path.join(process.cwd(), 'uploads')`。
   → 新增 `backend/src/shared/storage/paths.ts`（`resolveUploadDir()` / `UPLOAD_URL_PREFIX` / `toUploadUrl()`），写入方与静态服务共用，杜绝"写这里、URL 指那里"的静默 404；`UPLOAD_DIR` 补进 `env.ts` Zod 校验与 `.env.example`。
3. **容器内写入路径落在持久化卷之外**：`WORKDIR /app` + `ENTRYPOINT node backend/dist/app.js` ⇒ cwd 为 `/app`，默认 `uploads` 解析成 `/app/uploads`；而 compose 把卷挂在 `/app/backend/uploads` —— **上传的图片不在卷里，容器重建即丢**。
   → 两个 compose 显式设置 `UPLOAD_DIR=/app/backend/uploads`。
4. **Nginx 缺 location 且会被正则抢占**：两个配置都补了 `location ^~ /uploads/` 反代到后端，用 `^~` 修饰符确保不被 `~* \.(png|jpg|…)$` 抢占。

**顺带修掉的错误处理缺陷**：`toHttpError` 只认大写业务码，其他一律归 500。
框架/插件自带的 4xx（静态服务拒绝路径穿越的 403、multipart 超限的 413）因此被吞成 500 —— 调用方无法区分"请求有问题"与"服务坏了"，还会污染监控的 5xx 计数。
→ 现在尊重 `statusCode` 为 4xx 的错误，并映射到对应业务错误码。

**验证方式（本地实测，非推断）**

| 用例 | 结果 |
|---|---|
| `GET /uploads/probe.png` | `200` `image/png`（修复前必然 404） |
| `GET /uploads/2026/09/nested.png`（子目录） | `200` `image/png` |
| `GET /uploads/nope.png` | `404` |
| `GET /uploads/`（目录列表） | `404` |
| 路径穿越 `../package.json`、`%2e%2e`、`..%2f..%2f` | 修复前 `500` → 修复后 **`403 FORBIDDEN`**，响应体无内部信息泄露 |
| `pnpm --filter backend build` / `test` | 通过（6 tests） |
| GitHub Actions | 两个 workflow 均注册为 `active`；CI run #1 由 master 推送触发 |

> ⚠️ 尚未验证项：本机 Docker 守护进程未运行、也没有 nginx 二进制，因此 **Nginx 配置未经 `nginx -t` 语法校验**，compose 的上传路径改动也无法本地起容器验证。上线前请在服务器执行 `sudo nginx -t`。

### 已完成修复记录（P0-3 Thesis 分层重构）

**落地结构**（与 order 模块对齐）

| 文件 | 职责 |
|---|---|
| `thesis.routes.ts` / `thesis.admin.routes.ts` | 薄路由：鉴权 → `parseDto` 校验 → 调 service → `successResponse` |
| `thesis.dto.ts` | 7 个 Zod schema（题目 / 进度 / 活动 / 漂浮字 / 公开查询 / id 参数） |
| `thesis.service.ts` | 业务逻辑，统一抛 `HttpError`；不碰 prisma、不碰 request |
| `thesis.repository.ts` | 全部 Prisma 访问，`select` 字段白名单 |
| `thesis.vo.ts` | 出参整形，按受众裁剪（公开视图**不含** `uniqueCode`） |
| `thesis.types.ts` | 共享类型与常量，零依赖（避免循环引用） |
| `framework/validation.ts` | 新增通用 `parseDto`：校验失败统一转 400 `VALIDATION_ERROR` |

**关键决策：统一响应契约（这条改变了接口形状，务必知情）**

原 thesis 是全项目**唯一**使用裸对象（`{project}` / `{ok:true}` / `{message}`）的模块，与 order 等模块的 `{success,data}` 以及项目文档中的「统一响应」约定不一致。本次统一为 `successResponse()` + `errorResponse()`，并**同步更新了 2 个消费方**：用户端 `frontend/src/pages/thesis/index.vue` 3 处、管理端 `admin/src/pages/thesis/index.vue` 5 处（取值从 `res.project` 改为 `res.data.project`）。

顺带修好的一个真实问题：管理端错误提示此前显示的是 axios 的英文报错——因为拦截器读 `response.data.error`，而 thesis 返回的是 `data.message`；统一后能正确显示「题目已存在」等业务文案。

**顺带修掉的实际缺陷**

| 问题 | 处理 |
|---|---|
| 进度百分比无范围校验（`Number()` 转换后直接入库） | DTO 校验 0–100 整数；空值不再被 coerce 成 0 |
| 删除截图 / 进度 / 题目只删数据库行，磁盘文件永久残留 | service 删除后清理本地文件，且只允许删上传目录内的文件（basename + 目录前缀校验，防路径穿越） |
| 写库失败会留下孤儿文件 | 落库异常时回滚已落盘文件 |
| 更新 / 删除不存在的记录抛 Prisma P2025 → 500 | 先查存在性，改为 404 |
| body 解析失败也被归为 500 | `toHttpError` 尊重 4xx 后返回 400 |
| service 直接持有 `prisma` 单例 | 全部下沉到 repository |

**验证**

- `pnpm --filter backend build` / `test`：0 错误，**25 passed**（新增 `backend/tests/unit/thesis.test.ts` 19 例，覆盖 DTO 边界与「公开视图不泄露 uniqueCode」这一安全性质）
- 用户端 `vite build` + `vue-tsc --noEmit`、管理端 `vite build`：均 exit 0
- HTTP 实测（校验路径不需要数据库）：非法验证码 / 空白题目 → `400 VALIDATION_ERROR` + `NOT_FOUND_MSG`；参数合法 → 透传到 service；管理端无 token → `401 UNAUTHORIZED`
- 未验证：涉及数据库的**成功**路径（本机无 PostgreSQL）

### 已完成修复记录（P0-4 图片上传安全校验）

**新增 `backend/src/shared/storage/image-upload.ts`**（各上传点复用；换 OSS 只需替换这里）

| 校验项 | 做法 |
|---|---|
| 文件类型 | **魔数嗅探**（PNG / JPEG / WEBP），只信文件内容，不信 `filename` 与 `Content-Type`；改名伪装直接拒 |
| 大小 | 单图 ≤ **5MB**：既在解析层 `req.file({ limits })` 限制（超限即中断读取，不会把大文件收进内存），也在存储层复查 |
| 文件名 | 落盘名 = `nanoid(24)` + **由魔数推导**的扩展名；用户原始名绝不进磁盘路径。展示名另做清理（剥路径、去控制字符、截断 80 字） |
| 落盘方式 | 先写 `.tmp` 再 `rename` 原子改名，避免读到半截文件 |
| 失败处理 | 类型不符 → 400 `FILE_TYPE_INVALID`；超限 → 413 `FILE_TOO_LARGE`；落库失败 → 回滚已落盘文件 |

**分层收紧**

- 全局 multipart 兜底上限 100MB → **10MB**（`plugins/multipart.ts`），各上传点的真实限制更严并显式传入
- Nginx `client_max_body_size` 110m → **12m**（两套配置），网关不再放行 110MB 的请求体

**关于 `file-type` 依赖**：后端是 CommonJS 构建，而 `file-type` v17+ 为 ESM-only（v16 是最后的 CJS 版本）。白名单只有 3 种格式，因此手写魔数嗅探（约 30 行、可单测）；若将来白名单显著扩大再换库。

**验证**

| 用例 | 结果 |
|---|---|
| 单测 `tests/unit/image-upload.test.ts`（17 例） | 通过：GIF/PDF/ZIP/纯文本/半截魔数全部拒绝；伪装文件被拒；超限 413；展示名跨平台清理（`../../etc/passwd`、`C:\...`、控制字符） |
| **集成测试** `tests/integration/thesis-upload.test.ts`（6 例） | 通过：`app.inject()` 走完整链路（mock 掉 Prisma，无需 PostgreSQL），实测状态码依次为 **401 → 403 → 400（伪装 GIF）→ 413（超限）→ 404（进度不存在）→ 200（合法 PNG 落盘）** |
| 全部测试 | **48 passed**（原 6 + thesis 19 + 上传 17 + 集成 6） |
| 落盘安全性 | 断言访问路径匹配 `^/uploads/[A-Za-z0-9_-]{24}\.png$`、不含用户名、且文件确实写在上传目录内 |
| 测试环境 | 新增 `tests/setup.ts` 兜底环境变量（本地不必准备 `.env` 即可跑测试） |

**仍未做（属 P1-6）**：图片仍存本地磁盘，未接 OSS。`ali-oss` 依赖已在 `backend/package.json`，接入点就是 `saveImageUpload()`；生产卷路径已在 P0-5 对齐。

### 已完成修复记录（P0-2 Compose / PM2 定位）

| 位置 | 改动 |
|---|---|
| `docker-compose.prod.yml` | 文件头声明为「生产环境唯一部署入口」，并注明 PM2 已降级为备用方案 |
| `deploy/ecosystem.config.js` | 补定位注释：**备用方案**＋使用前提（需先 `pnpm build:backend`、先停 Docker 方案）＋启动/停止命令，含 `env_production` 必须带 `--env production` 这个易错点 |
| `deploy/DEPLOY.md` | 顶部加醒目横幅：本文档是**备用方案**，生产用 Docker Compose，并给出互斥切换命令 |
| `README.md` | 部署章节拆为「生产：Docker Compose」/「备用：PM2 + 宿主机 Nginx」两节，补 CD 流程说明；技术栈表同步更新 |

四处统一强调的冲突点：**两套方式都占用 80 / 443 / 3000 端口，同时只能启用一套**，并给出互斥命令（`docker compose -f docker-compose.prod.yml down` / `pm2 delete jituo-api`）。

验证：`node --check deploy/ecosystem.config.js` 通过，且 `require()` 后关键字段不变（name / script / instances / exec_mode / env_production）；两个 compose 文件仍能被 YAML 解析器解析。**PM2 本身未实测**（本机未安装 pm2）。

### 已完成修复记录（P0-6 README 全面重写）

README 按路线图要求重写为 12 节（含锚点目录）：项目简介 / 技术栈 / **系统架构图**（运行时 + 部署拓扑两张 ASCII 图）/ 功能模块 / 工程结构 / 本地开发 / 部署 / **运维能力（独立成节）** / 环境变量 / 测试 / 分支策略与 CI/CD / 已知不足与后续计划。

- **运维能力**单独成节：健康检查、文件上传安全、数据备份、监控、日志与资源限制、安全基线
- **已知不足**如实列出：`forum`/`content`/`marketing` 未分层、备份未上 OSS 且无 `restore.sh`、监控栈未纳管、图片仍在本地盘、PG 未容器化、不用 Redis、K8s 不替换生产
- CI 状态徽章；截图位置留了 TODO HTML 注释（仓库内无截图资源，不放假链接）

**写 README 时发现并修掉的问题**（这些都是"文档要求准确"逼出来的）

| # | 问题 | 处理 |
|---|---|---|
| 1 | **生产的 `/health` 被前端 SPA 回退接管**：实测 `https://jituo.online/health` 返回的是前端 HTML，而 `/api/config` 正常返回 JSON → `deploy.yml` 里的 `curl -f .../health` **在后端挂掉时也会通过**，健康检查形同虚设 | ① `deploy/nginx/jituo.conf` 补 `location = /health`（容器配置本来就有，宿主机配置漏了）；② `deploy.yml` 健康检查改为**校验响应体含 `"ok":true`** + 10 次重试 |
| 2 | 根目录缺 `dev:frontend` / `build:frontend` / `db:*` 脚本，README 无法统一到根目录命令 | 补齐 5 个脚本别名 |
| 3 | `admin/vite.config.ts` 的 dev 代理缺 `/uploads`，本地开发时管理端看不到上传的截图 | 补上代理 |
| 4 | 文档里的模型数过时（曾写 16 / 25） | 实测 schema 为 **30 个模型**，README 已按实际写 |
| 5 | 监控现状描述容易夸大 | README 如实写：管理端大屏**已消费** Prometheus 的 node_exporter 指标（含 24h/7天时序），但**后端无 `/metrics`**、监控栈部署清单未纳入仓库 |

**⚠️ 需要你确认的一件事**：生产当前跑的是哪套部署（宿主机 Nginx + PM2，还是容器）？
修好的 `location = /health` 需要同步到服务器上的 Nginx 配置并 `nginx -t && reload`，
之后 `https://jituo.online/health` 应返回后端 JSON 而不是前端页面。

**验证**：`node "$env:TEMP\yamlcheck\check.js"` 校验两个 workflow 仍可解析；实测后端返回体为 `{"ok":true,...}`（会被新检查判定为健康），而 SPA 回退的 HTML 不会被误判（判定为不健康）；根目录 `pnpm db:generate` 等新脚本可执行。

### 已完成修复记录（P1-2 / P1-3 / P1-4 监控）

**后端指标**：新增 `backend/src/plugins/metrics.ts`（prom-client 15.1.3）

| 指标 | 说明 |
|---|---|
| `http_requests_total{method,route,status}` | 请求量、状态码分布 |
| `http_request_duration_seconds{...}` | 响应时间直方图（桶 5ms–5s），可算 P95/P99 |
| `http_requests_in_flight` | 正在处理的请求数 |
| prom-client 默认指标 | `process_*` / `nodejs_*`：CPU、内存、Event Loop 延迟、GC、句柄数 |

- **标签基数防护**：标签用**路由模板**而非真实 URL；未匹配路由统一记 `unmatched`；`/metrics` 自身不计入业务指标（避免自噪声）
- **不对外暴露**：后端端口只绑 `127.0.0.1`，且两套 Nginx 配置都加了 `location = /metrics { return 404; }`

**监控栈纳入版本管理**：新增 `deploy/monitoring/`

| 文件 | 内容 |
|---|---|
| `docker-compose.monitoring.yml` | Prometheus v3.15.0 + node_exporter v1.12.1（host 网络）+ Grafana 13.2.3（桥接，仅 `127.0.0.1:3001`，密码必填无默认弱口令） |
| `prometheus/prometheus.yml` | 3 个抓取任务：后端 `/metrics`、node_exporter、Prometheus 自身；保留 15 天 |
| `prometheus/rules/alerts.yml` | 7 条规则：后端掉线、5xx>5%、P95>1s、Event Loop>0.5s、磁盘>85%、内存>90%、负载过高 |
| `grafana/provisioning/*` | 数据源（固定 `uid=prometheus`）+ 仪表盘 provider |
| `grafana/dashboards/jituo-overview.json` | 7 个面板：QPS、5xx 占比、P95/P99、进程内存、Event Loop、宿主机资源、抓取状态 |
| `README.md` | 启动方式、SSH 隧道访问、以及 host 网络取舍的说明 |

**镜像版本是查出来的，不是凭记忆写的**：本机 Docker Hub API 不可达，改用 GitHub Releases API 取到真实最新稳定版（Prometheus v3.15.0 / Grafana v13.2.3 / node_exporter v1.12.1）再写进 compose，避免 `docker compose pull` 因 tag 不存在而失败。

**为什么 Prometheus 用 host 网络（取舍）**：后端只监听 `127.0.0.1:3000`，桥接网络内的容器抓不到；若抓 `host.docker.internal`，它解析到网关地址（如 172.17.0.1），回环上监听的端口依然不可达。因此让 Prometheus / node_exporter 用 host 网络直接抓 `127.0.0.1` —— 无论后端是 Docker Compose 还是 PM2 部署都能工作。代价是这两个容器与宿主机共享网络命名空间（它们只监听回环端口，风险可控）。

**验证**

| 项 | 结果 |
|---|---|
| 测试 | **55 passed**（新增 `tests/integration/metrics.test.ts` 7 例：指标家族存在、路由模板聚合、未匹配记 `unmatched` 且响应体中不含原始 URL、抓取自身不计入） |
| 真实抓取 `GET /metrics` | `200` + `text/plain; version=0.0.4`，**11883 字节 / 30 个 metric family** |
| 实测样本 | `http_requests_total{method="GET",route="/health",status="200"} 6`、`{route="unmatched",status="404"} 1`、`process_resident_memory_bytes 105893888`、`nodejs_eventloop_lag_seconds 0`、`nodejs_heap_size_used_bytes 27158744` |
| 配置校验 | 9 个 YAML（监控栈 5 + compose 2 + workflow 2）全部解析通过；Grafana 仪表盘 JSON 有效（7 面板、id 唯一、数据源引用统一） |
| **未验证** | 本机 Docker 守护进程未运行、也无法访问 Docker Hub → **镜像拉取与 Prometheus/Grafana 实际运行未验证**；PromQL 未经 `promtool` 校验 |

### 已完成：Docker 验证（本机无守护进程，尽量做到最好）

**结论：本机跑不了 Docker，镜像构建与容器运行仍未验证。**

| 检查项 | 结果 |
|---|---|
| docker CLI | ✅ 29.8.0（WinGet 装的独立 CLI） |
| Docker 守护进程 | ❌ `\\.\pipe\docker_engine` 不存在 |
| Docker Desktop | ❌ 未安装 |
| compose 插件 | ❌ 无（`docker compose` → unknown command），也没有 docker-compose v1 |
| WSL2 | ❌ 未安装 |
| `registry-1.docker.io` / `auth.docker.io` / `ghcr.io` | ✅ 经本机代理均可达 → 装上守护进程后拉镜像没问题 |

**过程中两个障碍及解决（换机器可复用）**

1. 从 GitHub Releases 下载资源报 `schannel: CRYPT_E_REVOCATION_OFFLINE` —— 不是网络不通，而是 **TLS 吊销检查连不上吊销服务器**；加 `--ssl-no-revoke` 即通（证书链仍然校验）。
   ⚠️ 这个坑此前**误导过判断**：`ghcr.io` / `auth.docker.io` 一度被判为"不可达"，其实是同一个原因，加上该参数后分别是 401 / 200（即正常可达）。
2. Docker Hub 的 API 本机不可达 → 镜像版本号改从 GitHub Releases API 取。

**没有守护进程也做到了的真实验证**

| 手段 | 结果 |
|---|---|
| compose v2 单文件二进制（下到临时目录直接运行，**未安装、未改 PATH**） | `docker compose config` 通过：`docker-compose.dev.yml` 与 `deploy/monitoring/…` 均 exit 0；`docker-compose.prod.yml` 在缺 `backend/.env` 时**刻意失败**（缺配置就不该能构建），补上后通过 |
| **hadolint** v2.15.1 | 两个 Dockerfile **0 告警**：修掉了 DL3025（HEALTHCHECK 非 JSON 形式 ×2）、DL3059（连续 RUN）、DL3008/DL3018（未锁 apt/apk 版本 → 按要求写了**带理由**的 `hadolint ignore`，而不是无脑锁版本） |
| 解析结果核对 | `docker compose config` 确认 `UPLOAD_DIR: /app/backend/uploads` —— P0-5 的修复确实落到容器环境变量里 |

**又抓到一个会静默破坏管理员登录的真 bug**

`docker compose` 会对 `env_file` 的值做变量插值：bcrypt 哈希 `$2b$10$xxxx` 里的 `$xxxx` 被当变量替换成空串 → 哈希被截断为 `$2b$10`，**服务照常启动、管理员永远登不上**（只给一条 warning）。
试过 `env_file: format: raw` 来关掉插值，但它会把引号也当成值的一部分（`DATABASE_URL` 变成带引号的字符串），反而会弄坏现有 `.env`，故未采用。

处理（一并做了四处）：

1. `backend/src/config/env.ts`：把 `$$` 还原成 `$`，**并在启动时校验 bcrypt 格式**（60 字符正则）——非法值直接启动失败，并给出「生成命令 + compose 路径需写成 `$$`」的提示，**把静默故障变成显式错误**
2. `.env.example`、`README.md`、`deploy/DEPLOY.md`：写明 compose 路径下 `$` 需写作 `$$`
3. `docker-compose.dev.yml` 自己的占位哈希也中招（`$2b$10$PLACEHOLDER` 被吃掉）→ 改为 `$$` 转义
4. `ci.yml` / `deploy.yml` / `tests/setup.ts` 的 CI 占位哈希换成**真实合法的 bcrypt**（否则会被新的格式校验拦下）

**把验证固化进 CI**（否则只是一次性检查）：`ci.yml` 新增 `docker-config` job

- hadolint 校验两个 Dockerfile
- 用真实 compose 校验三个 compose 文件，并把**「插值警告」当失败拦下** —— 正是上面那个 bug 的回归防线，并附反例测试
- 该脚本已在本机用 bash + compose 二进制实跑验证：**正例 exit 0；反例（故意不转义）被 `::error::` 拦下 exit 1**

> 想让镜像构建也进入 CI：现在 `deploy.yml` 只在打 tag/手动触发时构建镜像，
> 如需每次推送都验证 build，可在 `docker-config` job 里加 `docker build`（会让 CI 变慢数分钟）。

---

## 1. 最终形态

```
              GitHub (master)
                 │
                 ▼
          GitHub Actions
                 │
                 ▼
               GHCR
                 │
                 ▼
        ┌─────────────────┐
        │  Cloud Server   │
        │     Ubuntu      │
        └────────┬────────┘
                 │
          Docker Compose
                 │
       ┌─────────┼─────────┐
       ▼         ▼         ▼
     Nginx    Backend   PostgreSQL
                 │
                 ▼
              OSS  ◄──── 上传图片 / 数据库备份
                 │
                 ▼
              Backup

       Monitoring
           │
     ┌─────┴─────┐
     ▼           ▼
 Prometheus   Grafana  ◄── node_exporter（宿主机指标）
```

面试时可以完整讲的一条链路：

> 代码开发 → Git 提交 → GitHub Actions → Docker 构建 → GHCR → 云服务器拉取 → Docker Compose 部署 → Nginx HTTPS → PostgreSQL → Prometheus 监控 → OSS 备份

---

## 2. P0：必须完成

### ✅ P0-1 统一 CI/CD 触发分支（已完成）

**问题**（已确认，见 §0-1）：workflow 监听 `main`，实际生产分支是 `master`，导致 CI/CD 形同虚设。

**做法**：

1. 先定分支策略，二选一，不要混：
   - **方案 A（推荐，改动最小）**：继续用 `master` 作为生产分支，把所有 workflow 的 `branches: [main]` 改成 `[master]`。
   - **方案 B**：在 GitHub 把默认分支改成 `main`，本地 `git branch -m master main` 再推。
2. 修改 `.github/workflows/ci.yml`（`pull_request.branches`）与 `.github/workflows/deploy.yml`（`push.branches`）。
3. 顺手确认 `deploy.yml` 里的镜像名 `ghcr.io/cn-jia/jituo-*` 与仓库 owner 一致。
4. 加一个「不通过就拦住」的开关：在 GitHub 仓库设置里把 `backend-test` / `typecheck` 设为必需检查（分支保护）。

**验收**：往 `master` 推一个空提交 → Actions 页面能看到 CI + Deploy 两条流水线都跑起来；Deploy 最后一步 `Health check` 输出成功。

**面试话术**：

> 项目使用 GitHub Actions 实现持续集成和自动部署，代码提交后自动构建 Docker 镜像并推送 GHCR，再通过 SSH 更新云服务器上的服务。

---

### ✅ P0-2 明确 Docker Compose 是生产主链路，PM2 定位为传统/备用方案（已完成）

**做法**：

1. `docker-compose.prod.yml` 保持不动作为**唯一生产部署方式**；在文件头部注释里写清定位。
2. **不要删除 PM2**。在 `deploy/ecosystem.config.js` 头部补一段注释，明确它是「传统 Node.js 部署方案 / 备用方案（不使用容器时）」。
3. 在 README 的部署章节里把两条路径分节写：`生产（Docker Compose，推荐）` / `备用（PM2 + 宿主机 Nginx）`。
4. 消除歧义：两套方式都会占用 `80/3000` 端口，文档里明确「同时只能启用一套」。

**验收**：README 里能一眼看出"生产用哪套、PM2 何时用"。

**面试话术**：

> 项目早期采用 PM2 管理 Node.js 服务，后续进一步容器化后生产环境主要使用 Docker Compose 管理服务，PM2 作为传统部署方式保留。

---

### ✅ P0-3 Thesis 模块分层重构（已完成）

**目标结构**（与 order 模块对齐）：

```
backend/src/modules/thesis/
├── thesis.routes.ts          # 用户侧：薄层，仅校验 → 调 service → 统一响应
├── thesis.admin.routes.ts    # 管理侧：同上
├── thesis.service.ts         # 业务逻辑、事务编排
├── thesis.repository.ts      # 新增：封装 Prisma 访问
├── thesis.dto.ts             # 新增：入参 Zod schema + 类型
├── thesis.vo.ts              # 新增：出参字段裁剪（白名单）
└── thesis.types.ts           # 新增：模块内共享类型
```

**分层方向**：

```
Route → DTO（校验）→ Service（业务）→ Repository（Prisma）→ PostgreSQL
```

**做法**：

1. 先把 `thesis.admin.routes.ts` 和 `thesis.routes.ts` 里**所有直接的 `prisma.*` 调用**下沉到 `thesis.repository.ts`（当前 route 里大量存在，如进度/截图/活动的 CRUD）。
2. 所有 `req.body as any` 换成 `thesis.dto.ts` 的 Zod schema 解析，错误统一走 `errorResponse` + `ERROR_CODES`。
3. 出参统一在 `thesis.vo.ts` 里做字段白名单裁剪，不再直接返回 Prisma model。
4. **注意**：`thesis.admin.routes.ts` 当前的返回格式是 `{ progress }` / `{ ok: true }` / `{ image }`，**不是**全局的 `{ success, data }` 包装。重构时要么全模块统一到 `successResponse`，要么全模块保持现状 —— 但前端调用方要同步确认，别只改后端。
5. 顺带把「进度百分比」加范围校验（0–100），这是当前缺失的业务校验。

**验收**：`grep -r "prisma\." backend/src/modules/thesis/*.routes.ts` 无结果；`pnpm build:backend` 通过；thesis 相关页面功能回归正常。

**面试话术**：

> 后端采用 Route、Service、Repository 分层，Route 主要负责请求和参数处理，Service 负责业务逻辑，Repository 负责数据库访问，使用 Prisma 操作 PostgreSQL。

---

### ✅ P0-4 图片上传安全校验（已完成）

**现状问题**（见 §0-5）：100MB 上限、无类型白名单、直接用用户扩展名、DB 存原始文件名。

**目标链路**：

```
用户上传图片 → Backend → 类型/大小校验 → 存储（先本地，P1 换 OSS） → DB 存 Object Key / URL
```

**做法**：

1. **类型白名单**：只允许 `jpg / jpeg / png / webp`。不要只信 `filename` 扩展名，用 `mimetype` + **magic number 嗅探**（`file-type` 包或 `sharp().metadata()`）双重校验 —— 面试时这点值得强调：「不能只校验扩展名，要校验文件真实类型」。
2. **大小限制**：图片路由单独设 ≤ 5MB（用 `req.file({ limits: { fileSize: 5 * 1024 * 1024 } })` 覆盖全局的 100MB，或按路由传 limits）。注意 Nginx 侧 `client_max_body_size` 目前是 `110m`，可单独给上传接口收紧。
3. **文件名处理**：只用「UUID/nanoid + 白名单推导出的扩展名」，**永远不落用户原始文件名到磁盘路径**（防目录穿越、防覆盖）。原始文件名如需展示，只作为 DB 字段存"展示用名字"。
4. **存储目录**：`UPLOAD_DIR` 环境变量统一（当前 thesis 路由硬编码 `path.join(process.cwd(), 'uploads')`，与 `UPLOAD_DIR` 设计不一致，要改齐）。
5. **统一封装**：把校验 + 落盘 + 返回 URL 抽成一个 `upload.service.ts`（或 `shared/storage/`），供后续所有上传点复用，也为 P1 换 OSS 留单一改动点。
6. 校验失败返回 4xx + 明确错误码，不要静默存坏文件。

**验收**：上传 `.exe`（改名成 `.png`）被拒；上传 6MB 图片被拒；正常 png/jpg/webp 成功且磁盘文件名为随机串；DB 中不再出现路径穿越型文件名。

---

### ✅ P0-5 修 `/uploads/` 访问链路（已完成 —— 实际比预想严重得多）

**问题**（见 §0-7）：容器化 Nginx 配置里没有 `/uploads/`，且正则静态资源 location 会抢先匹配图片后缀 → 上传成功但页面 404。

**做法**（推荐方案，与现有架构最贴合）：

1. 图片是持久化在 backend 容器 volume（`./backend/uploads`），**由后端 Fastify 静态服务提供**（当前已有 `/uploads/` 前缀静态服务）。所以 Nginx 只需要把 `/uploads/` **反代到 backend**：

```nginx
# 上传文件 —— 反代到 backend（放在正则静态资源 location 之前不必，但必须在语义上独立）
location /uploads/ {
    proxy_pass http://jituo_api;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    expires 7d;
    add_header Cache-Control "public";
}
```

2. ⚠️ **关键点**：上面这个前缀 location 会被**正则 location** `~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$` 抢先匹配（Nginx 正则优先于前缀）。所以必须二选一：
   - 用 `location ^~ /uploads/ { … }`（`^~` 命中后跳过正则匹配）—— **推荐**；
   - 或把静态资源正则改写成排除 uploads。
3. 两套 Nginx 配置都要改：`deploy/nginx-docker.conf`（容器内）与 `deploy/nginx/jituo.conf`（宿主机 PM2 备用方案）。宿主机方案里 `/uploads/` 另有两条可选路径（宿主机 `alias /var/www/jituo/backend/uploads/;` 或同样反代），选一致的那种。
4. 备份/迁移时别忘了 `uploads/` 目录也在数据范围内（见 P1-5）。

**验收**：`curl -I https://jituo.online/uploads/<某真实文件名>.png` → `200` 且 `Content-Type: image/png`；容器重建后老图片仍可访问。

---

### ✅ P0-6 README 全面更新（已完成）

README 是这个项目给 HR / 技术面的第一入口，**结构比内容更重要**。

**必备章节**：

1. 一句话项目定位 + 访问地址 + 截图/GIF（后台管理端也放一张）。
2. 技术栈表（Fastify / Prisma / PostgreSQL / Vue3 / Docker / Nginx / GHCR / Prometheus…）。
3. **架构图**（用 §1 的 ASCII 图或补一张 draw.io 图）。
4. 本地开发（环境要求 + 安装 + 数据库初始化 + 三端启动命令，全部统一到根目录 `pnpm` 脚本）。
5. 部署：`生产 = Docker Compose`（含 CD 流程图）/ `备用 = PM2`。
6. 运维能力：监控、备份与恢复、上传校验、健康检查 —— **这一节是运维岗位的加分点，要单独成节**。
7. 目录结构（用 §6 的目标结构）。
8. 分支策略 + CI/CD 说明（对应 P0-1）。

**验收**：新人只看 README 能跑起来；运维相关能力在目录里可见（有锚点）。

---

## 3. P1：提升运维含金量

### ☐ P1-1 核心业务自动化测试（10～20 个起步）

不足 10 个也不用硬凑，但**状态机 + 积分**这两块必须有。

**订单状态机**（`CREATED → PENDING → IN_PROGRESS → COMPLETED`，含取消）：

- 合法流转通过
- **非法流转被拒**（如 `COMPLETED → IN_PROGRESS`）
- 取消订单正常
- **重复取消被拒**

**积分规则**：

- 邀请注册 +50
- 首次购买 +100
- 新用户首次购买 +30

**兑换/优惠券**：

- 正常兑换
- 积分不足被拒
- **重复兑换被拒**
- 库存不足被拒

**做法**：沿用已有 `backend/tests/unit/`（现有 `order-status.test.ts`）；业务逻辑测试优先于 route 层测试；状态与积分规则尽量纯函数化后再测（这正是 P0-3 分层带来的红利）。

**验收**：`pnpm test` 全绿；CI 里 `backend-test` job 能真实拦住回归。

---

### ✅ P1-2 / P1-3 Prometheus + Grafana（后端指标）（已完成）

**架构**：

```
Grafana ──查询──► Prometheus ──抓取──► Node Backend /metrics
```

**做法**：

1. 后端引入 `prom-client`，暴露 `GET /metrics`（**记得在 Nginx 上限制外部访问**，只允许内网/抓取源，不要公网裸奔）。
2. 采集指标：
   - HTTP 请求量（counter，按 method / route / status 打标签 —— 标签不要带原始 URL，避免高基数）
   - HTTP 响应时间（histogram，出 P50/P95/P99）
   - 5xx 数量
   - Node 进程指标（`collectDefaultMetrics`：CPU、内存、Event Loop lag、GC、句柄数）
3. `deploy/monitoring/prometheus/prometheus.yml` + `deploy/monitoring/grafana/`（含 provisioning 的 datasource 与 dashboard，做到 `docker compose up` 后面板开箱可用）。
4. Grafana 面板建议 4 个：QPS/错误率、P95 延迟、进程内存与 Event Loop、容器资源。

**验收**：Prometheus targets 页面 backend 为 `UP`；Grafana 能看到实时 QPS 与 P95；面板 JSON 已提交到仓库（面试可展示）。

---

### ✅ P1-4 node_exporter（宿主机监控）（已完成）

**做法**：服务器部署 `node_exporter`（systemd 或容器），Prometheus 增加一个 scrape job，Grafana 导入 Node Exporter 官方面板。

**采集**：CPU、内存、磁盘、网络、负载、文件系统使用率。

**加分**：配一条磁盘使用率 > 85% 的告警规则（Alertmanager 可先不做，规则文件先写）——面试讲「我配了磁盘水位告警」比只讲"我装了 exporter"有力得多。

**验收**：Grafana 能看到 `node_*` 指标；`docker-compose` 与宿主机两种部署方式都写进文档。

---

### ☐ P1-5 数据库自动备份 + 恢复脚本（**已有基础，补齐两处**）

**现状**：`deploy/backup.sh` 已实现 `pg_dump | gzip`、保留 7 天、crontab `0 3 * * *`。

**待补**：

1. **上传 OSS**：脚本末尾加 `ossutil cp`（或 `aliyun oss cp`），备份文件推送到 OSS 指定路径，例如 `oss://<bucket>/jituo/backup/`。
2. **`deploy/restore.sh`**：支持从本地文件或 OSS 拉取后恢复，**恢复前先做一次安全备份**，并要求显式确认参数。
3. **`deploy/health-check.sh`**（计划里提到）：检查容器状态 + `/health` + 磁盘水位 + 最近一次备份时间是否超期，可用于 crontab 或手动巡检。
4. `backup.sh` 里补充：失败时不要静默（`set -e` 已有，但 OSS 上传失败要有非零退出与日志）、记录日志文件、`DB_NAME/DB_USER` 改为读环境变量而不是硬编码。
5. ⚠️ **本机备份不够**：备份文件别只留同一台服务器（磁盘挂了就一起没），OSS 这一步是"异地"的关键，别省。
6. **真跑一次恢复验证**：`restore.sh` 只有被真实执行过才算完成 —— 面试时可以说「做过恢复演练」。

**验收**：手动执行一次备份 → 本地与 OSS 都有 `.sql.gz`；在测试库跑一次 `restore.sh` 后数据可用；文档写明 cron 配置。

**面试话术**：

> 项目针对 PostgreSQL 增加了定时备份机制，通过 pg_dump 导出数据库并压缩后上传 OSS，同时保留恢复脚本进行数据恢复验证。

---

### ☐ P1-6 OSS 存储（把上传从本地盘迁到对象存储）

**做法**：

1. 引入 `ali-oss`，`shared/storage/` 里做一层抽象（`save(file) → { key, url }`），P0-4 的封装点在这里换成 OSS 实现，本地实现保留给开发环境。
2. 上传链路：校验（P0-4）→ 生成 `key`（如 `thesis/{yyyy}/{mm}/{uuid}.{ext}`）→ 上传 OSS → DB 只存 **Object Key**；URL 由配置的域名/CDN 前缀拼接（不要把带签名的临时 URL 存库）。
3. 环境变量：`OSS_REGION / OSS_BUCKET / OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_PUBLIC_BASE_URL`，补进 `backend/.env.example` 并在 `config/env.ts` 里做 Zod 校验。
4. 迁移历史图片：写一次性脚本，把 `uploads/` 存量文件推到 OSS 并回写 DB（面试可讲"做过存量数据迁移"）。
5. 权限：Bucket 只开必要的公共读；**AK/SK 绝不进仓库**，放服务器环境变量或 CI secrets。

**验收**：新上传图片 URL 指向 OSS；`docker-compose.prod.yml` 里的 uploads volume 可降级为「开发/兜底」或移除；存量图片可正常显示。

---

## 4. P2：云原生加分项（**实验环境，不替换生产**）

**做法**：单独建 `deploy/k8s/`，做一套可演示的清单，**生产继续用 Docker Compose**。

```
deploy/k8s/
├── namespace.yaml
├── configmap.yaml
├── secret.yaml            # 只放模板，真实值用 kubectl create secret
├── pvc.yaml
├── backend-deployment.yaml
├── backend-service.yaml
├── frontend-deployment.yaml
├── frontend-service.yaml
├── ingress.yaml
└── README.md              # 写明：这是实践环境，生产仍是 Docker Compose
```

**要点**：

- 本地用 kind / minikube 跑通即可，不必上云 K8s（成本与风险都不划算）。
- 值得在 README 里点出的细节：`readinessProbe` / `livenessProbe` 用现有 `/health`；资源 `requests/limits` 与 compose 里的 `mem_limit` 对齐；`ConfigMap` vs `Secret` 的边界；Ingress 对应现在的 Nginx 职责。
- **不要**为了简历把生产切到 K8s —— 挂了面试时更难解释。

**验收**：`kubectl apply -f deploy/k8s/` 在本地集群能起来，`kubectl get pods` 全 Running，Ingress 能访问；README 有截图。

**面试话术**：

> 项目生产环境目前采用 Docker Compose，另外编写 Kubernetes Deployment、Service、ConfigMap、Ingress 等资源文件进行云原生部署实践。

---

## 5. 明确不做的两件事

| 项 | 结论 | 理由 |
|---|---|---|
| **Redis** | ❌ 现在不接 | 业务上暂时没有缓存/分布式 Session/限流的真实需求，硬塞只会给自己挖面试坑（"为什么用它""缓存一致性怎么保证"）。已有 AI-CloudOps 项目可以证明接触过 Redis。**如果**将来要做接口限流或验证码，再按需引入。 |
| **K8s 替换生产** | ❌ 不替换 | 单机 Docker Compose 完全够用，且更稳、更好维护。K8s 只作为 `deploy/k8s/` 的实践项（见 P2）。 |

---

## 6. 目标目录结构

```
jituosc/
│
├── frontend/                  # 用户端 Vue3
├── admin/                     # 管理端 Vue3 + Element Plus
│
├── backend/
│   ├── src/modules/
│   │   ├── system/            # 用户/认证
│   │   ├── order/             # 订单（分层标杆：已有 repository）
│   │   ├── product/           # 商品/交易
│   │   ├── points/            # 积分
│   │   ├── forum/             # 论坛
│   │   ├── content/           # 内容运营
│   │   ├── marketing/         # 营销活动
│   │   └── thesis/            # ★ P0-3 补齐分层
│   ├── src/shared/storage/    # ★ P0-4 / P1-6 统一存储抽象
│   ├── prisma/
│   └── tests/                 # ★ P1-1
│
├── deploy/
│   ├── docker-compose.yml / docker-compose.prod.yml
│   ├── nginx/                 # 宿主机方案
│   ├── nginx-docker.conf      # 容器方案 ★ P0-5 补 /uploads/
│   ├── monitoring/            # ★ P1-2/3/4
│   │   ├── prometheus/
│   │   └── grafana/
│   ├── k8s/                   # ★ P2
│   ├── backup.sh              # 已有，待补 OSS 上传
│   ├── restore.sh             # ★ P1-5 新增
│   └── health-check.sh        # ★ P1-5 新增
│
├── docs/
│   └── cloudops-roadmap.md    # 本文件
│
├── .github/workflows/
│   ├── ci.yml                 # ★ P0-1 改 master
│   └── deploy.yml             # ★ P0-1 改 master
│
└── README.md                  # ★ P0-6 全面更新
```

---

## 7. 执行顺序（按这个顺序做，别跳）

**🔴 第一阶段：P0**

```
① 修 CI/CD 分支 master/main            （10 分钟，先做，否则后面改了也不触发）
        ↓
② 明确 Docker Compose 生产 / PM2 备用   （文档级，半小时）
        ↓
③ 修 Nginx /uploads/ 链路（真 bug）      （1 小时，影响线上功能）
        ↓
④ 图片上传安全校验                       （半天，含存储抽象）
        ↓
⑤ Thesis 模块分层重构                    （1～2 天，最费时）
        ↓
⑥ README 全面更新                        （半天，最后做，把前面成果写进去）
```

**🟠 第二阶段：P1**

```
① 核心业务测试（状态机 + 积分）           （1～2 天）
        ↓
② Prometheus + /metrics                 （1 天）
        ↓
③ Grafana 面板 + provisioning            （半天）
        ↓
④ node_exporter + 磁盘告警规则           （半天）
        ↓
⑤ 备份补 OSS 上传 + restore.sh + 恢复演练（半天）
        ↓
⑥ 上传迁移 OSS（含存量迁移脚本）          （1 天）
```

**🟡 第三阶段：P2**

```
Kubernetes 实践环境（本地 kind/minikube）
├── Namespace / ConfigMap / Secret / PVC
├── Backend & Frontend Deployment + Service
├── Ingress
└── README + 截图
```

---

## 8. 面试话术对照表

| 面试官问 | 用哪个模块回答 |
|---|---|
| 你们怎么做 CI/CD？ | P0-1：Actions 构建镜像 → GHCR → SSH 拉取 → Compose 部署 → migrate → 健康检查 |
| 为什么同时有 PM2 和 Docker？ | P0-2：早期 PM2，后续容器化，PM2 作传统部署方式保留 |
| Node.js 后端怎么设计的？ | P0-3：Route / DTO / Service / Repository 分层，Prisma 操作 PostgreSQL |
| 上传功能怎么保证安全？ | P0-4：类型白名单 + magic number 嗅探 + 5MB 限制 + UUID 重命名 + OSS |
| 线上图片打不开，你怎么排查？ | P0-5：Nginx location 匹配优先级（`^~` vs 正则）、反向代理与静态资源职责划分 |
| 怎么保证数据安全？ | P1-5：pg_dump + gzip + OSS 异地 + 保留 7 天 + restore.sh 恢复演练 |
| 你怎么做监控？ | P1-2/3/4：/metrics + Prometheus + Grafana，业务指标（QPS/P95/5xx）与主机指标（CPU/内存/磁盘）分层 |
| 接触过 K8s 吗？ | P2：写过 Deployment/Service/ConfigMap/Ingress 实践，并说明生产为何仍用 Compose（**诚实且加分**） |
| 为什么没用 Redis？ | §5：按需引入，不做无业务支撑的技术堆砌 |

---

**最后一句话**：做到这里，这个项目就不再只是「一个毕业设计网站」，而是一份能完整讲出「我做了什么、为什么这么做、出问题怎么查」的云计算运维 / DevOps 实践项目 —— 而且每一条都对应真实操作，不需要靠简历包装硬撑。
