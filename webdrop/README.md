# webdrop · 文件中转站

一个自托管的网页版文件中转站。浏览器打开就能传文件，不用装任何客户端。

面向的场景是**在弱网、慢速上行、链路会抖的环境下传大文件** —— 所以上传做成了分片 + 断点续传 + 逐片校验，而不是一个请求怼上去。

## 特性

**上传**
- **分片上传**：默认每片 8MB，单片失败只重传这一片，不会前功尽弃
- **断点续传**：`uploadId` 由 `(文件名, 大小, 修改时间)` 推导，关掉页面、断网、甚至换台机器重选同一个文件都能接着传
- **并发上传**：默认 3 片并发，实测能把 1.7 MB/s 的单流上行提到 2.4 MB/s
- **逐片 SHA-256 校验**：服务端验签通过才落盘，链路把数据传坏了立刻发现并让客户端重传，不会静默产出损坏文件
- **指数退避重试**：每片最多重试 6 次，带随机抖动避免惊群
- **原子落盘**：分片先写 `.tmp` 再改名；合并写 `.assembling` 再改名。**没传完的文件不会出现在列表里**，也永远不会留下一个看起来正常、实际残缺的文件
- 实时显示百分比 / 已传字节 / 速率 / 剩余时间

**文件管理**
- 拖拽或点选，支持多选、手机端可用
- 文件列表按时间倒序，显示大小与时间
- 下载 / 删除（删除有二次确认）
- 顶部显示服务器剩余磁盘空间

**其他**
- 密码登录，HMAC 签名 Cookie（`HttpOnly` + `Secure` + `SameSite=Lax`），改 `secret` 可让所有人下线
- 登录失败限流：同 IP 15 分钟 10 次
- 路径穿越防护：文件名严格校验，`../`、`\`、绝对路径全部拒绝
- 入口 HTML 强制不缓存，改版后不会有人卡在旧页面
- 分片目录 24 小时自动清理
- 统一错误处理，绝不把堆栈返回给客户端
- 手机端自适应

## 快速开始

```bash
git clone <this-repo> webdrop && cd webdrop
npm install

cp config.example.json config.json
# 编辑 config.json：至少改掉 password 和 secret
#   secret 用 openssl rand -hex 24 生成

npm start
# 访问 http://127.0.0.1:3010
```

生产环境建议由 nginx 反代并加 HTTPS：

```nginx
location = /files { return 301 /files/; }

location ^~ /files/ {
    client_body_timeout 300s;      # 默认 60s，弱网下大文件很容易被掐断
    send_timeout 300s;

    proxy_pass http://127.0.0.1:3010/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";

    client_max_body_size 2048m;
    proxy_request_buffering off;   # 大文件不落 nginx 磁盘，直接流给后端
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

> 两个容易踩的坑：
> 1. 必须用 `^~` 前缀匹配。如果站点里还有 `location ~* \.(js|css|png)$` 这类正则 location，正则优先级高于普通前缀，会把 `/files/` 下的静态资源抢走返回 404。
> 2. `client_body_timeout` 默认只有 60 秒，指的是**两次读操作之间**的间隔。慢速链路上只要卡顿超过 1 分钟，nginx 就会掐断上传。

## 配置项

`config.json`：

| 字段 | 默认 | 说明 |
|---|---|---|
| `port` | 3010 | 监听端口，只绑 `127.0.0.1` |
| `password` | — | 网页登录密码 |
| `secret` | — | Cookie 签名密钥，必须改 |
| `dataDir` | `data` | 成品文件目录 |
| `chunkDir` | `chunks` | 分片暂存目录 |
| `cookiePath` | `/files` | 必须与 nginx 的路径前缀一致 |
| `maxFileMB` | 2048 | 单文件上限 |
| `maxChunkMB` | 64 | 单片上限 |
| `chunkTTLHours` | 24 | 分片保留时长，超时自动清理 |
| `sessionDays` | 30 | 登录有效期 |

## HTTP 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/login` | 密码登录，下发签名 Cookie |
| `POST` | `/logout` | 退出 |
| `GET` | `/api/session` | 查询登录状态 |
| `GET` | `/api/list` | 文件列表 + 磁盘空间 |
| `GET` | `/api/chunk/status/:uploadId` | 查询该次上传已收到哪些分片（续传依据） |
| `POST` | `/api/chunk` | 上传单个分片。裸二进制体，元数据走请求头：`X-Upload-Id`、`X-Chunk-Index`、`X-Chunk-Sha256` |
| `POST` | `/api/chunk/complete` | 合并分片为最终文件 |
| `POST` | `/api/upload` | 小文件单请求直传（保留的简易通道） |
| `GET` | `/api/download/:name` | 下载 |
| `POST` | `/api/delete` | 删除 |
| `GET` | `/api/health` | 健康检查 |

## 实测数据

在一个真实环境里（Ubuntu 22.04 / 1.7 MB/s 上行 / 链路偶有抖动）传一个 300MB 文件：

- 上传到 35% 时强制刷新页面打断
- 重选同一文件 → 提示「已续传 13/38 片」，从第 13 片接着传
- 全程 73.4 秒完成
- 两端 SHA-256 完全一致，逐字节正确
- 分片目录与临时文件自动清理干净

## 为什么不用 multipart 传分片

分片请求把二进制直接放在请求体里，元数据走请求头。省掉 multipart 的边界解析开销，服务端用 `express.raw` 拿到 Buffer 直接算哈希落盘，客户端也能把 `Blob` 切片直接 `send()`，两边都不产生额外拷贝。

## License

MIT
