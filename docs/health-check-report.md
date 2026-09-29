# 极拓空间 · 系统健康度与完成度测试报告

> 测试对象：**线上生产环境** `https://jituo.online`（阿里云 ECS `47.239.27.77`，Ubuntu 22.04）
> 测试方式：SSH 登录生产机 + 真实 HTTP 请求 + 真实浏览器（Playwright）+ 数据库只读/定点查询
> 测试时间：2026-09-30 01:04 ～ 01:19（CST）
> 原则：**先备份再动手**、**只增不删**、**每条结论都附真实命令输出**、**没测的说没测**

---

## 0. 测试前的前置动作（安全兜底）

| 动作 | 结果 |
|---|---|
| 全库备份 | `/home/jia/backups/jituo/pretest_20260930_010838.sql.gz`（12098 字节，dump 内 30 张表，md5 `3889beda41145b953a672a33a890fddd`） |
| 全表行数基线 | `/home/jia/backups/jituo/pretest_baseline_20260930_010838.txt`（30 张表，共 **91 行**） |
| 测试数据登记 | `/home/jia/backups/jituo/testdata_20260930_011304.txt`（每条测试数据的 id 都在里面，便于精确删除） |
| 前端旧产物备份 | `frontend-dist-20260930_011010.tar.gz` / `admin-dist-20260930_011010.tar.gz`（回滚用） |
| Nginx 配置备份 | `jthub.conf.bak.20260930_010856` / `jthub.conf.bak.cache.20260930_011055` |

⚠️ 基线脚本踩到一个坑并已修正：`.env` 里的 bcrypt 哈希含 `$2b$10$...`，在 `set -u` 下 `source .env` 会直接以 `$2: unbound variable` 崩掉。正确做法是**只 grep 出 `DATABASE_URL`**，不要 source 整个 `.env`（`deploy/backup.sh` 用的就是这个方式）。

---

## 1. 总体结论

**能跑，而且核心业务链路是通的**：注册/登录/防爆破/限流/下单/订单查询/发帖/积分/转盘/毕设进度查询/管理端鉴权、HTTPS 证书自动续期、PM2 开机自启、Nginx 日志轮转、数据库备份脚本——逐项实测都正常，前端 12 个页面在真实浏览器里全部渲染出数据、**0 个控制台报错**。

**但有 2 个「静默失效」级别的问题 + 5 个中等 bug + 一批运维缺口**，其中两个静默失效会让真实用户/你自己的业务受损却毫无提示：

| 级别 | 问题 | 影响 |
|---|---|---|
| 🔴 高 | 邮件验证码**发送失败时接口仍返回「验证码已发送」** | 新用户收不到码 → 永远注册不了，且没人知道 |
| 🔴 高 | 新订单通知**完全没生效**（`SERVERCHAN_TOKEN` 是空值） | 用户提交需求后你不会收到任何提醒 |
| 🟠 中 | 资料页「年级 = 不设置」保存**必然 400 参数错误** | 该选项永远存不上（已在真实 UI 复现） |
| 🟠 中 | 毕设页「活动公告 / 公告漂浮字」**永远显示为空** | 库里有 4 条活动，用户看不到 |
| 🟠 中 | `GET /api/posts?page=0` → **500** | 分页参数未校验，非法入参打成服务器错误 |
| 🟠 中 | 请求体是坏 JSON → **500**（应为 400） | 客户端问题被记成服务端故障，污染 5xx |
| 🟠 中 | 对未审核帖子评论报「帖子不存在」；作者也看不到自己的待审核帖 | 发帖后没有任何地方能看到它 |

---

## 2. 本次测试期间已修复并验证的问题

### 2.1 `/health` 被前端 SPA 接管（原有的真问题，已修）

- 现象：`https://jituo.online/health` 返回 `200 text/html`（前端 index.html），后端挂了也照样 200 → `deploy.yml` 的健康检查形同虚设。
- 处理：给线上 `/etc/nginx/sites-available/jthub.conf` 补 `location = /health`（反代 `127.0.0.1:3000`），`nginx -t` 通过后 reload。
- 验证：连续 3 次请求均 `200 application/json`，响应体 `{"ok":true,...}`；前端导航栏的「运行 18天7时」也随之正常（前端 `getHealth()` 打的就是 `/health`）。

### 2.2 `/metrics` 对外应是 404

- 线上 Nginx 原本没有 `location = /metrics`，靠 SPA 回退返回 200 HTML（不是真指标，但语义混乱）。
- 已补 `location = /metrics { return 404; }`；实测 `code=404`。

### 2.3 **SPA 入口 HTML 被缓存 → 老访客永远看不到新站**（本次新发现并修复）

- 发现过程：部署新前端后用浏览器打开首页，渲染出来的**还是旧文案**（「让学业不再是负担」），而服务器上的新产物里确实有新文案。
- 定位：不是 Service Worker（`navigator.serviceWorker.getRegistrations()` 为 0），是 **HTTP 缓存**——Nginx 对所有 `.js/.css` 发 `Cache-Control: public, immutable` + 30 天，而 `index.html` 只有 `Last-Modified/ETag`，浏览器按「启发式缓存」把它当新鲜内容留着；清掉浏览器缓存重新加载后，文案才变成新的。
- 风险：旧 HTML 引用的是**已经被删掉的旧 hash 资源**，一旦浏览器缓存里那几块 JS 被淘汰，用户看到的就是**白屏**。
- 处理：新增两条精确 location，HTML 一律 `no-cache, must-revalidate`，hash 资源继续 immutable：

```
location = /index.html       { root /home/jia/jituosc/frontend/dist; add_header Cache-Control "no-cache, must-revalidate"; }
location = /admin/index.html { alias /home/jia/jituosc/admin/dist/index.html; add_header Cache-Control "no-cache, must-revalidate"; }
```

- 验证：`/`、`/index.html`、`/admin/`、`/admin/index.html`、`/lucky-wheel`、`/thesis`、`/nonexistent` 全部返回 `no-cache, must-revalidate`；带 `If-None-Match` 条件请求返回 **304**（省流量）；hash 资源仍是 `max-age=2592000, public, immutable`。

### 2.4 新前端 + 管理端已部署上线

- 本地 `pnpm --filter frontend build` / `--filter admin build` 成功，打包上传 → 服务器端解压替换（先备份旧 dist）。
- 验证：新入口 `index-CDhAkf76.js` / `index-C_8Tgb_X.css` / `admin/assets/index-DmA2SU8y.js` 全部 200；旧入口 `index-3fxudFZl.js` 已 404；抽查 20 个 chunk 全 200。
- 真实浏览器验证：hero 文案已是「极 · 创代码，拓 · 见未来 / 你的全栈技术外包与作业协助专家 / 复杂交给我，上岸留给你。」，hero 代码条、HUD 数据卡、「01 价格参考」玻璃行（价格来自数据库 100-300/200-500/500-2000 元）、「02 / 为什么选择我们」编号卡片、「03 服务流程」、底部 CTA 全部渲染正常；顶部品牌 logo 与导航**未改动**。
- 管理端登录页深色主题正常（`极拓空间 管理后台`）。

### 2.5 幸运转盘弹窗已关闭（按你的要求）

`update activity_popup set enabled = false where id = 'singleton'` → 接口 `/api/activity-popup` 现在返回 `{"enabled":false}`，首页实测不再弹窗。

---

## 3. 测出的真 bug（含复现证据）

### 3.1 🔴 邮件验证码失败时接口仍报「验证码已发送」

**证据（线上实测）**

| 步骤 | 结果 |
|---|---|
| `POST /api/auth/send-code`，邮箱用 `probe.…@example.com` | `HTTP 200 {"success":true,"data":{"message":"验证码已发送"}}`，库里确实新增了 1 行 |
| 直接用配置里的 key 调 Resend 发同一个地址 | `HTTP 422 {"message":"Invalid `to` field. Please use our testing email address instead of domains like `example.com`"}` |
| 用同一个 key 发到 Resend 官方测试地址 | `HTTP 200 {"id":"01a0ee2b-…"}` → 说明 **key 和发信域名都是好的** |

**根因**：Resend SDK v4 的 `emails.send()` 把 API 错误放在返回值的 `error` 字段里、**不抛异常**；而
`backend/src/services/email.service.ts` 的 `sendVerifyCode()` 只是 `await resend.emails.send(...)`，调用方
`system.routes.ts:37-41` 的 `try/catch` 因此永远抓不到 → 接口无条件返回 200。

**影响**：任何一个发信失败（收件地址异常、配额用完、Resend 故障、域名被限）都会被伪装成成功，用户干等验证码，你也查不出原因。

**建议修法**：`sendVerifyCode` 检查返回值 `if (error) throw new Error(...)` 并写日志；路由失败时返回 500 且提示「验证码发送失败，请稍后重试或联系管理员微信」。

### 3.2 🔴 新订单通知完全没生效

**证据**

| 检查 | 结果 |
|---|---|
| `SERVERCHAN_TOKEN` 长度 | **0（空值）** |
| 我用测试账号真实下了一单（`JT-20260930-7WRM`） | `notifications` 表 **0 行**（既没有 SUCCESS 也没有 FAILED） |
| 用空 token 调 Server酱 接口 | `HTTP 403 {"error":"Forbidden"}` |
| 代码 | `order.notify.ts:73`：`if (!env.SERVERCHAN_TOKEN) return` —— 直接静默返回，连日志都不写 |

**影响**：客户提交需求后**你不会收到任何提醒**，只有主动去刷新管理端才看得到新订单。对一个靠「1-2 小时响应」做卖点的业务，这是直接影响成交的缺口。

**建议**：二选一——① 去 Server酱申请 token 填进 `SERVERCHAN_TOKEN`；② 换成管理端轮询（`admin_notifications` 表目前是空的，`/api/admin/notifications` 接口存在但没有数据写入方），或两者都做。另外建议把「未配置 token」时的静默 skip 改成启动时警告日志。

### 3.3 🟠 资料页「年级 = 不设置」无法保存（真实 UI 复现）

**证据**

- 接口层：`PUT /api/auth/profile` 传 `{"grade":""}` → `400 参数错误`；传 `{"phone":""}` → `400 参数错误`；传合法值 → `200`；空对象 → `200`。
- 页面层（Playwright 真实点击）：`/profile` 里把「年级」选成「不设置」→ 点「保存修改」→ 页面提示 **「参数错误」**，控制台同时报错。

**根因**：`frontend/src/pages/profile/index.vue:147` 用 `phone: d.phone ?? ''`、`grade: d.grade ?? ''` 初始化并整表提交；后端 `z.enum([...]).optional()` 不接受空字符串（可选 ≠ 可为空串）。

**影响**：只要有用户没填手机号/年级（或以后新增字段），资料就存不上，且提示是无信息量的「参数错误」。
现状 3 个用户都有手机号+年级，所以这颗雷**暂时没被引爆**，但选项就摆在界面上，随时会踩。

**建议**：后端把空串当「未设置」处理（`z.enum([...]).or(z.literal('')).optional()` 并在服务层转成 `null`），前端提交前过滤空串；同时把 `参数错误` 换成具体字段提示。

### 3.4 🟠 毕设进度页的「活动公告」和公告漂浮字永远为空

**证据**

| 项 | 值 |
|---|---|
| 后端 `/api/thesis/activities` 实际返回 | `{"activities":[{"id":4,...},{"id":3,...}]}`（库里 4 条，`published:true`） |
| 后端 `/api/thesis/site-notice` 实际返回 | `{"text":"所有进度实时上传，有问题请联系管理员","enabled":true}` |
| 前端读取方式 | `thesis/index.vue:100` `const notice = res.data`；`:114` `res.data?.activities \|\| []` |
| 真实页面渲染 | 「活动公告」区域显示 **「暂无活动公告」**，公告漂浮字也不出现 |

**根因**：thesis 模块的用户侧接口**没有使用统一的 `{success, data}` 包装**（其它模块都有），而前端按 `res.data` 读 → 恒为 `undefined`。

**建议**：统一 thesis 接口的响应包装（或前端改成读 `res.activities` / `res.text`），并在 CI 里加一条接口契约测试防止再次漂移。

### 3.5 🟠 `GET /api/posts?page=0&limit=9999` → 500

**证据**：线上 `code=500 {"success":false,"error":{"code":"INTERNAL_ERROR",...}}`（正常分页 `page=1&limit=5` 是 200）。
**根因**：`backend/src/modules/forum/forum.routes.ts:11-25` 直接 `Number(page)`、`Number(pageSize)` 拼进 Prisma 的 `skip/take`，`page=0` → `skip=-1` 直接抛异常；`page=abc` 同理；`limit=9999` 也没有上限。当前 master 代码**仍然如此**（我读代码确认过，不是老构建独有）。
**建议**：用项目里已有的 `parseDto` + Zod 做 `page ≥ 1`、`1 ≤ pageSize ≤ 50` 的强制约束。

### 3.6 🟠 坏 JSON 返回 500

**证据**：`POST /api/orders`，body 是 `{bad json` → `code=500 INTERNAL_ERROR`。正确语义是 400。
**说明**：当前 master 的 `framework/errors.ts` 已经会尊重框架错误的 4xx 状态码（所以重新部署后会变 400，但错误码会原样带上框架内部码 `FST_ERR_CTP_INVALID_JSON_BODY`，建议再收敛成 `VALIDATION_ERROR`）。**线上这个 500 是 9/14 老构建的行为**。

### 3.7 🟠 未审核的帖子既看不到也评论不了，且报错语义错

**证据**：`POST /api/posts` → `201 {"message":"发布成功，等待管理员审核"}`（状态 `PENDING`）；紧接着 `POST /api/posts/<该帖>/comments` → `404 {"code":"VALIDATION_ERROR","message":"帖子不存在"}`。
**根因**：评论接口要求 `status: 'APPROVED'`（`forum.routes.ts:89`），帖子确实存在却报「不存在」（应 403/409 并说明「帖子审核中」）；同时前端**没有任何「我的帖子」入口**，作者发完就再也看不到它。
**建议**：区分「不存在」与「未审核」；补一个「我的帖子（含审核状态）」页面或在发帖成功页给出状态查询入口。

### 3.8 🟡 一批运维/加固缺口（不致命但都会被面试官/攻击者问到）

| 项 | 实测 | 建议 |
|---|---|---|
| 安全响应头 | 首页与 API 均**没有** `Strict-Transport-Security` / `X-Content-Type-Options` / `X-Frame-Options` / `Content-Security-Policy` / `Referrer-Policy` | Nginx 里统一 `add_header`；管理端尤其需要防点击劫持 |
| 静态资源压缩 | `/` 有 `Content-Encoding: gzip`，但 **JS/CSS 没有**（Nginx 默认只压 `text/html`）。admin 主包 **1.2MB → gzip 后 388KB** | `gzip_types text/css application/javascript application/json image/svg+xml;`（可再上 `gzip_static`） |
| HTTP/2 | `listen 443 ssl;`（无 `http2`） | 加上 `http2`，多路复用对 1.2MB 的 admin 包收益明显 |
| 后端监听地址 | 实际 `0.0.0.0:3000`（文档里写的是「只绑 127.0.0.1」） | 改成 `127.0.0.1`（少一层依赖安全组的侥幸）；实测 3000/9090/9100 从我这侧 TCP 不可达，说明目前靠**阿里云安全组**挡着，而**主机 ufw 是 inactive、iptables INPUT 是 ACCEPT** |
| 密钥文件权限 | `backend/.env` 是 `-rw-rw-r--`（同机任何用户可读） | `chmod 600` |
| 备份自动化 | `crontab -l` → **no crontab for jia**；备份脚本本身没问题（手动跑成功，产出 16K dump + 轮转日志） | 加 cron：`0 3 * * * /home/jia/jituosc/deploy/backup.sh` |
| PM2 配置与线上不符 | 实际进程名 `jthub-api`、cwd `/home/jia/jituosc/backend`；仓库里两份 ecosystem 都写 `jituo-api` + `/var/www/jituo` | 按实际改写，让「配置即真相」 |
| 监控栈 | 线上跑的是 **系统包 Prometheus 2.31.2 + node_exporter 1.8.2**（systemd），只抓 `localhost:9100` 和自身；**没有后端 job**、**Grafana 未运行**；仓库里 `deploy/monitoring/` 的容器栈并未部署 | 文档要按实际写；后端 `/metrics` 上线后再加抓取 job |
| 已部署后端落后 | `dist/app.js` 构建于 **2026-09-14 14:37**，`/metrics` 404、无上传 magic number 校验 | 需要一次正规的后端重新部署（见 §6） |

---

## 4. 通过的项目（健康度的正面证据）

| 类别 | 实测结果 |
|---|---|
| 公开接口 | `/api/config`、`/api/order-types`(3)、`/api/activities`(2)、`/api/carousel`(3)、`/api/posts`(3+1)、`/api/activity-popup`、`/api/thesis/site-notice`、`/api/thesis/activities`(4)、`/api/shop/items`(3) 全部 200 且数据结构正确 |
| 鉴权 | 8 个用户接口 + 5 个管理接口，无 token 一律 401；伪造 JWT 也被 401 拒绝 |
| 防爆破 | 连续错误密码：`还剩 4/3/2/1 次机会` → 第 5 次「账号已锁定，请 … 秒后重试」（数据库 `loginAttempts`/`lockUntil` 落地） |
| 限流 | 60 秒内第二次发验证码 → `429 RATE_LIMITED` |
| 注册登录 | 发码 → 校验码 → 注册返回 JWT → 登录返回 JWT（196 字符）→ `/auth/me` 正确 |
| 改密码 | 改 → 新密码能登录 → 改回原密码 → 错误旧密码被 400 拒绝 |
| 下单 | `POST /api/orders` → `JT-20260930-7WRM`、状态 `PENDING`、写入了 1 条状态历史；订单详情 200、不存在订单 404 `ORDER_NOT_FOUND`、过去截止日期 400、未登录 401 |
| 发帖 | `201`「发布成功，等待管理员审核」，库中状态 `PENDING` |
| 积分/商城 | 余额 0、明细空、邀请码 `3ULHEH` 与邀请链接生成正确；兑换积分不足 → 400、商品不存在 → 404（**不是 500**） |
| 幸运转盘 | `/lucky-wheel/info` 返回 8 个奖项；抽奖 1 次成功（写入 `spin_results`），第 2、3 次正确返回「抽奖次数已用完」 |
| 毕设进度查询 | 正向：真实题目 + 查询码 → 200，返回项目 + **5 条进度 + 4 张进度图**；错误查询码 404、缺查询码 400（均为友好文案，无 500） |
| 前端页面 | `/`、`/activity`、`/forum`、`/forum/:id`、`/thesis`、`/profile`、`/points`、`/points/shop`、`/invite`、`/lucky-wheel`、`/my-orders`、`/submit`、`/forum/new` —— 13 个路由**全部渲染出真实数据，控制台 0 报错**；登录 UI 走通并正确切换登录态 |
| 静态资源 | `/uploads/case-placeholder-1.svg` 200 `image/svg+xml`；不存在的文件 404；**路径穿越 `--path-as-is` 三种编码全部 400** |
| SPA 回退 | `/admin/`、`/admin/login`、`/admin/dashboard`、`/lucky-wheel`、`/nonexistent` 都是 200 且正确回退 |
| HTTPS | HTTP→HTTPS 301；TLS **1.3**；证书 Let's Encrypt，`notAfter=Dec 13 2026`，`certbot.timer` 在跑（自动续期） |
| 运行稳定 | PM2 `jthub-api` online 15 天、重启 5 次、内存 80MB；**错误日志为空**；`pm2-jia.service` 已 enabled（重启会自启） |
| 资源 | 磁盘 8.3G/40G（23%）、内存 678M/1736M（可用 864M，swap 未用）、负载 0.06 |
| 数据库备份 | `deploy/backup.sh` 手动执行成功：`jthub_prod_20260930_011801.sql.gz`（16K）+ 自动清理日志 |
| 日志轮转 | Nginx access/error 日志按天轮转（保留 14 份 gz），logrotate 配置在位 |
| 数据完整性 | 订单类型 3 / 活动 2 / 轮播 3 / 文章 4 / 积分商城 3 / 优惠券模板 2 / 毕设项目 8 / 进度图 16 / 用户 3 —— 与基线逐项对齐，无孤儿数据 |
| 代码质量 | 本地 `tsc --noEmit` 通过、`seed-demo.ts` 单独类型检查通过、CI（`backend-test` / `docker-config` / `typecheck`）3 个 job 全绿 |

---

## 5. 测试产生的数据与清理方案

本次测试**只新增、未修改任何既有业务数据**（受保护表 thesis_projects 8 / progresses 24 / images 16 / users(真实 2 个) / site_notices 1 前后一致）。

新增（marker 统一为 `healthcheck.20260930_011304`）：

| 表 | 新增 | 标识 |
|---|---|---|
| `users` | 1 | `username = hc20260930_011304` |
| `orders` + `order_status_history` | 1 + 1 | `orderNo = JT-20260930-7WRM` |
| `posts` | 1 | `title like 'healthcheck.%'`（状态 PENDING，前端不可见） |
| `spin_results` | 1 | 关联测试用户 |
| `email_verifications` | 3 | `email like 'healthcheck.%'` / `probe.%` |

**清理 SQL（待你确认后再执行，我没有擅自跑）**

```sql
BEGIN;
-- 依赖顺序：先子表后主表
DELETE FROM order_status_history WHERE "orderId" IN (SELECT id FROM orders WHERE "orderNo" = 'JT-20260930-7WRM');
DELETE FROM orders              WHERE "orderNo" = 'JT-20260930-7WRM';
DELETE FROM comments            WHERE "postId" IN (SELECT id FROM posts WHERE title LIKE 'healthcheck.%');
DELETE FROM posts               WHERE title LIKE 'healthcheck.%';
DELETE FROM spin_results        WHERE "userId" IN (SELECT id FROM users WHERE username = 'hc20260930_011304');
DELETE FROM point_logs          WHERE "userId" IN (SELECT id FROM users WHERE username = 'hc20260930_011304');
DELETE FROM point_balances      WHERE "userId" IN (SELECT id FROM users WHERE username = 'hc20260930_011304');
DELETE FROM users               WHERE username = 'hc20260930_011304';
DELETE FROM email_verifications WHERE email LIKE 'healthcheck.%' OR email LIKE 'probe.%';
-- 顺手清掉两条历史遗留的未使用验证码（非本次测试产生，可选）
DELETE FROM email_verifications WHERE email IN ('test-check@jituo.online') AND "usedAt" IS NULL;
COMMIT;
-- 校验：应与测试前基线完全一致（30 张表 / 91 行）
```

**回滚兜底**：真删错了也能用 `pretest_20260930_010838.sql.gz` 恢复到测试前状态。

---

## 6. 待你决策的几件事

1. **线上后端要不要部署到最新 master？**
   现在线上是 9/14 的构建：`/metrics` 404、上传 magic number 校验、统一错误结构、thesis 分层重构全都没上线。
   服务器**能连 GitHub**（实测 `git fetch` 1.9 秒成功，`ls-remote` 拿到 `ab1cc8a`），但本地 HEAD `3c1ddf8` 与远端 `ab1cc8a` **历史已分叉**（本地领先 104 / 落后 15，因为远端历史被重写过），所以只能 `git reset --hard origin/master`（会丢弃服务器上那 3 个未提交改动，其中 `backend/uploads/` 是上传的图片目录，需要保留）。
   我建议的顺序：备份 → `git reset --hard origin/master` → `pnpm install` → `pnpm --filter backend build` → `pm2 reload jthub-api` → 回归冒烟。
2. **修哪些 bug？** 我的优先级：3.1 邮件静默失败 → 3.2 订单通知 → 3.3 资料页空串 → 3.4 thesis 响应契约 → 3.5 分页校验 → 3.8 里的安全头/gzip（Nginx 层，几分钟）。
3. **测试数据现在删还是等后端部署完再删？**（建议：等部署完、回归冒烟过了一遍再删，删之前再备份一次）
4. **管理端正向流程还没测**：`/api/admin/*` 的写操作、thesis 图片上传（含 magic number 校验）、订单报价/状态流转，都需要管理员账号密码——你不方便给的话，可以我出步骤、你在管理端点着走。

---

## 7. 本次测试**没有**验证的（诚实清单）

- 管理端登录后的所有正向流程（缺管理员密码）
- 真实邮件送达（只验证到 Resend API 返回 200 + 域名已验证；没有真实收件箱可确认收信）
- 微信/小程序端订单来源（`source: 'MINIPROGRAM'` 路径）
- 容器化链路（镜像构建/运行、`docker-compose.prod.yml`、`deploy/monitoring/` 容器栈）：**本机没有 Docker 守护进程，线上也没跑容器**
- 支付配置（`payment_config` 表为空）、优惠券/积分的完整核销闭环（需要管理端配合改状态）
- 高并发/压测（只做了单次请求与限流验证）
- 备份恢复演练（`restore.sh` 尚未编写，P1-5 待做）
