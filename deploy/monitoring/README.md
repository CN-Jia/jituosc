# 极拓空间 · 监控栈

Prometheus + Grafana + node_exporter，**全部纳入版本管理**：配置文件与仪表盘都在本目录，
换台服务器照着重跑一遍即可得到同样的监控。

```
┌──────────────┐   抓取 127.0.0.1:3000/metrics   ┌──────────────────────┐
│  Prometheus  │ ◄────────────────────────────── │ Backend（Fastify）    │
│  (host 网络)  │                                 │ http_requests_total  │
│              │   抓取 127.0.0.1:9100           │ http_request_dur…    │
│              │ ◄────────────────────────────── │ process_* / nodejs_* │
└──────┬───────┘                                 └──────────────────────┘
       │                                          ┌──────────────────────┐
       │ ◄───────── node_exporter（宿主机指标）──── │ CPU/内存/磁盘/网络     │
       │                                          └──────────────────────┘
       │ 查询
┌──────▼───────┐
│   Grafana    │  仪表盘「极拓空间 · 总览」随启动自动加载
└──────────────┘
```

## 启动

```bash
cd deploy/monitoring
echo "GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 24)" > .env   # 不设默认弱密码
docker compose -f docker-compose.monitoring.yml up -d
```

| 服务 | 地址 | 说明 |
|---|---|---|
| Prometheus | `127.0.0.1:9090` | Targets / Alerts / Rules 页面在此查看 |
| node_exporter | `127.0.0.1:9100` | 只对内网提供指标 |
| Grafana | `127.0.0.1:3001` | 仪表盘「极拓空间 · 总览」；账号 `admin` |

三者都只绑定回环地址，不对公网暴露。本机访问 Grafana 用 SSH 隧道：

```bash
ssh -L 3001:127.0.0.1:3001 <user>@<server>
# 然后本地打开 http://localhost:3001
```

## 仪表盘面板

| 面板 | 指标 |
|---|---|
| 请求量 QPS（按状态码） | `sum by (status) (rate(http_requests_total[1m]))` |
| 5xx 错误率 | `5xx / 总请求`，阈值 1% 橙、5% 红 |
| 响应时间 P95 / P99 | `histogram_quantile(…, http_request_duration_seconds_bucket)` |
| Node 进程内存 | `process_resident_memory_bytes`、`nodejs_heap_size_used_bytes`（并标出接近容器 256M 限制的线） |
| Event Loop 延迟 | `nodejs_eventloop_lag_seconds` / `…_p99_seconds`，阈值 0.5s |
| 宿主机资源 | node_exporter 的 CPU / 内存 / 根分区使用率 |
| 抓取目标状态 | `up`（1 = UP），一眼看出后端或 exporter 是否掉线 |

## 告警规则

`prometheus/rules/alerts.yml` 已定义（**只定义规则，未接 Alertmanager**，通知可按需再加）：

| 规则 | 触发条件 |
|---|---|
| `JituoBackendDown` | 后端连续 2 分钟抓不到 |
| `JituoHighErrorRate` | 5xx 占比 > 5%（5 分钟） |
| `JituoHighLatencyP95` | P95 > 1s（5 分钟） |
| `JituoEventLoopLagHigh` | Event Loop 延迟 > 0.5s |
| `HostDiskUsageHigh` | 根分区使用率 > 85%（10 分钟） |
| `HostMemoryUsageHigh` | 内存使用率 > 90%（10 分钟） |
| `HostLoadHigh` | 5 分钟负载 > CPU 核数 × 2 |

## 网络模式的取舍（为什么 Prometheus 用 host 网络）

后端只绑定 `127.0.0.1:3000`（见 `docker-compose.prod.yml`），**桥接网络里的容器抓不到它**。
若把监控栈放进独立 compose 的桥接网络，就必须让 Prometheus 的抓取目标指向
`host.docker.internal`，而那解析到宿主机的网关地址（如 172.17.0.1），回环上监听的后端不可达。

因此选择：**Prometheus 与 node_exporter 用 host 网络**，直接抓 `127.0.0.1`。
这样无论后端是 Docker Compose 还是 PM2 部署都能工作，两种部署路径通用。
代价是这两个容器与宿主机共享网络命名空间 —— 它们本身只监听回环端口，风险可控。

## 与后端的关系

后端 `/metrics` 由 `backend/src/plugins/metrics.ts` 提供（prom-client），
Nginx 对 `/metrics` 显式返回 404（见两套 nginx 配置），确保不随反代规则变化而外泄。
管理端「监控大屏」也在消费 Prometheus（`PROMETHEUS_URL`），与 Grafana 共用同一数据源。
