# 极拓空间 生产部署文档

**目标系统**：Ubuntu 24.04 LTS  
**架构**：Nginx（反向代理 + 静态文件）+ PM2（Node.js 守护）+ PostgreSQL 16  
**最终访问地址**：
- 用户端：`https://yourdomain.com`
- 管理后台：`https://yourdomain.com/admin/`
- API：`https://yourdomain.com/api/`

---

## 目录

1. [服务器初始化](#1-服务器初始化)
2. [安装运行时依赖](#2-安装运行时依赖)
3. [安装 PostgreSQL 16](#3-安装-postgresql-16)
4. [上传项目代码](#4-上传项目代码)
5. [配置环境变量](#5-配置环境变量)
6. [构建项目](#6-构建项目)
7. [初始化数据库](#7-初始化数据库)
8. [配置 Nginx](#8-配置-nginx)
9. [申请 SSL 证书](#9-申请-ssl-证书)
10. [PM2 启动后端](#10-pm2-启动后端)
11. [验证部署](#11-验证部署)
12. [后续更新流程](#12-后续更新流程)
13. [常见问题排查](#13-常见问题排查)

---

## 1. 服务器初始化

> 以 root 身份登录后执行

```bash
# 更新系统
apt update && apt upgrade -y

# 创建专用部署用户（避免 root 运行应用）
adduser deploy
usermod -aG sudo deploy

# 配置防火墙
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
ufw status

# 切换到 deploy 用户（后续所有操作均以 deploy 执行）
su - deploy
```

---

## 2. 安装运行时依赖

```bash
# ── Node.js 20 LTS ────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 验证
node -v   # 应输出 v20.x.x
npm -v

# ── pnpm ──────────────────────────────────────────────────────
sudo npm install -g pnpm
pnpm -v   # 应输出 9.x.x 或更高

# ── PM2（进程守护）────────────────────────────────────────────
sudo npm install -g pm2
pm2 -v

# ── Nginx ─────────────────────────────────────────────────────
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# ── Certbot（Let's Encrypt SSL）──────────────────────────────
sudo apt install -y certbot python3-certbot-nginx
```

---

## 3. 安装 PostgreSQL 16

```bash
# 添加官方源
sudo apt install -y curl ca-certificates
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
sudo sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
  https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  > /etc/apt/sources.list.d/pgdg.list'

sudo apt update
sudo apt install -y postgresql-16

sudo systemctl enable postgresql
sudo systemctl start postgresql

# 创建数据库和用户
sudo -u postgres psql <<EOF
CREATE USER jituo WITH PASSWORD '替换为强密码';
CREATE DATABASE jituo_prod OWNER jituo;
GRANT ALL PRIVILEGES ON DATABASE jituo_prod TO jituo;
EOF
```

> **重要**：把 `your_strong_password_here` 替换为强密码，下一步 `.env` 中要用。

---

## 4. 上传项目代码

### 方式 A：通过 Git（推荐）

```bash
# 在服务器上
sudo mkdir -p /var/www/jituo
sudo chown deploy:deploy /var/www/jituo

cd /var/www/jituo
git clone https://github.com/your-username/ai-jituo.git .
```

### 方式 B：通过 scp 直接上传（本地执行）

```bash
# 在本地 Windows PowerShell 中执行
# 先将本地项目打包（排除 node_modules、dist、.env）
# 然后上传

scp -r C:\Users\Admin\Desktop\ai-jituo deploy@your-server-ip:/tmp/jituo-upload

# 在服务器上解压到目标目录
sudo mkdir -p /var/www/jituo
sudo chown deploy:deploy /var/www/jituo
cp -r /tmp/jituo-upload/. /var/www/jituo/
```

### 方式 C：rsync（增量同步，本地执行）

```bash
# 在本地执行（排除不必要文件）
rsync -avz --progress \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.env' \
  --exclude='*.log' \
  C:/Users/Admin/Desktop/ai-jituo/ \
  deploy@your-server-ip:/var/www/jituo/
```

---

## 5. 配置环境变量

```bash
cd /var/www/jituo/backend

# 创建生产环境配置文件
nano .env
```

填写以下内容（**所有占位符必须替换**）：

```bash
# ── 数据库 ───────────────────────────────────────────────────
DATABASE_URL="postgresql://用户名:密码@localhost:5432/jituo_prod"

# ── JWT ──────────────────────────────────────────────────────
# 生成随机密钥：node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET="运行上面命令生成的随机密钥"
JWT_EXPIRES_IN="7d"

# ── Server酱推送（管理员新订单通知）─────────────────────────
# 申请地址：https://sct.ftqq.com/
SERVERCHAN_TOKEN="SCT_your_actual_token"

# ── 管理员账号 ───────────────────────────────────────────────
ADMIN_USERNAME="admin"
# 生成密码 Hash（在服务器本地执行）:
# cd /var/www/jituo/backend && node -e "const b=require('bcrypt'); b.hash('你的密码',10).then(console.log)"
ADMIN_PASSWORD_HASH="$2b$10$..."

# ── 管理员微信号（展示给用户的联系方式）─────────────────────
ADMIN_WECHAT_ID="你的微信号"

# ── 应用配置 ─────────────────────────────────────────────────
NODE_ENV="production"
PORT="3000"
APP_BASE_URL="https://yourdomain.com"
```

```bash
# 设置权限，防止其他用户读取
chmod 600 .env
```

**生成管理员密码 Hash**（在服务器上执行）：

```bash
cd /var/www/jituo/backend
node -e "const b=require('bcrypt'); b.hash('你设定的密码',10).then(console.log)"
# 把输出的哈希值填入 .env 的 ADMIN_PASSWORD_HASH
```

---

## 6. 构建项目

```bash
cd /var/www/jituo

# 安装所有依赖（生产 + 开发依赖，build 需要）
pnpm install

# ── 构建后端 ─────────────────────────────────────────────────
pnpm --filter backend build
# 产物位于 backend/dist/

# ── 构建 PC 用户端 ───────────────────────────────────────────
pnpm --filter jituo-frontend build
# 产物位于 frontend/dist/

# ── 构建管理后台 ─────────────────────────────────────────────
pnpm --filter admin build
# 产物位于 admin/dist/

# 确认构建产物存在
ls backend/dist/app.js
ls frontend/dist/index.html
ls admin/dist/index.html
```

---

## 7. 初始化数据库

```bash
cd /var/www/jituo/backend

# 生成 Prisma Client
pnpm prisma generate

# 执行数据库迁移（生产环境用 migrate deploy，不用 migrate dev）
pnpm prisma migrate deploy

# 插入默认种子数据（期中内作业/期末作业/毕业设计）
pnpm db:seed

# 验证：连接数据库查看表
pnpm prisma studio  # 可选，会在 5555 端口开启 Web UI
```

---

## 8. 配置 Nginx

### 8.1 创建 SSL 参数片段

```bash
sudo mkdir -p /etc/nginx/snippets

sudo tee /etc/nginx/snippets/ssl-params.conf > /dev/null <<'EOF'
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;
EOF
```

### 8.2 创建站点配置

```bash
sudo nano /etc/nginx/sites-available/jituo.conf
```

粘贴以下内容（**把 `yourdomain.com` 替换为你的真实域名**）：

```nginx
upstream jituo_api {
    server 127.0.0.1:3000;
    keepalive 32;
}

# HTTP → HTTPS 强制跳转
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Certbot 验证（申请证书时需要）
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include             /etc/nginx/snippets/ssl-params.conf;

    # 安全响应头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # PC 用户端静态文件
    location / {
        root /var/www/jituo/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, no-transform";
    }

    # 静态资源长缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        root /var/www/jituo/frontend/dist;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://jituo_api;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    # 管理后台（子路径 /admin/）
    location /admin/ {
        alias /var/www/jituo/admin/dist/;
        index index.html;
        try_files $uri $uri/ /admin/index.html;
    }
}
```

### 8.3 启用站点

```bash
# 先用 HTTP-only 临时配置测试（申请证书前 443 块无法生效）
# 把上面配置中 listen 443 整个 server 块先注释掉，或用下面的临时配置：
sudo tee /etc/nginx/sites-available/jituo-temp.conf > /dev/null <<'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 200 'ok';
        add_header Content-Type text/plain;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/jituo-temp.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## 9. 申请 SSL 证书

> 前提：域名 DNS 已解析到服务器 IP，且 80 端口可访问

```bash
# 创建 Certbot webroot 目录
sudo mkdir -p /var/www/certbot

# 申请证书（替换为你的真实域名和邮箱）
sudo certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d yourdomain.com \
  -d www.yourdomain.com \
  --email your@email.com \
  --agree-tos \
  --non-interactive

# 验证证书生成
ls /etc/letsencrypt/live/yourdomain.com/

# 配置自动续期（certbot 已自动创建 systemd timer）
sudo systemctl status certbot.timer
```

证书申请成功后，切换到正式 Nginx 配置：

```bash
# 删除临时配置，启用正式配置
sudo rm /etc/nginx/sites-enabled/jituo-temp.conf
sudo ln -s /etc/nginx/sites-available/jituo.conf /etc/nginx/sites-enabled/

sudo nginx -t          # 必须显示 "syntax is ok"
sudo systemctl reload nginx
```

---

## 10. PM2 启动后端

### 10.1 更新 ecosystem.config.js

```bash
nano /var/www/jituo/ecosystem.config.js
```

确认内容如下（把域名替换掉）：

```javascript
module.exports = {
  apps: [
    {
      name: 'jituo-api',
      script: './backend/dist/app.js',
      cwd: '/var/www/jituo',
      instances: 1,          // 小流量单实例即可，稳定后可改为 2
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '400M',
      error_file: '/var/log/jituo/error.log',
      out_file: '/var/log/jituo/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
}
```

### 10.2 创建日志目录并启动

```bash
sudo mkdir -p /var/log/jituo
sudo chown deploy:deploy /var/log/jituo

cd /var/www/jituo

# 启动
pm2 start ecosystem.config.js

# 查看状态（status 应为 online）
pm2 status
pm2 logs jituo-api --lines 20

# 设置开机自启
pm2 save
pm2 startup
# 复制上面命令输出的 sudo env PATH=... 命令并执行
```

---

## 11. 验证部署

```bash
# 1. 检查后端 API 健康
curl https://yourdomain.com/api/health
# 期望: {"status":"ok"}

# 2. 检查公开接口
curl https://yourdomain.com/api/order-types
# 期望: {"success":true,"data":[...]}

# 3. 检查用户端页面
curl -I https://yourdomain.com/
# 期望: HTTP/2 200

# 4. 检查管理后台
curl -I https://yourdomain.com/admin/
# 期望: HTTP/2 200

# 5. 检查后端日志无 ERROR
pm2 logs jituo-api --lines 50
```

浏览器验证：
- [ ] `https://yourdomain.com` 能看到首页（活动公告 + 价格表）
- [ ] `https://yourdomain.com/admin/` 能看到管理员登录页
- [ ] 管理员登录后能看到数据统计仪表盘
- [ ] 前端提交一条测试订单，管理后台能看到，Server酱 收到推送

---

## 12. 后续更新流程

每次本地改完代码后，执行以下步骤：

### 本地打包上传（Windows）

```powershell
# 方式：rsync（需要 WSL 或 Git Bash）
rsync -avz --progress `
  --exclude='node_modules' `
  --exclude='dist' `
  --exclude='.env' `
  C:/Users/Admin/Desktop/ai-jituo/ `
  deploy@your-server-ip:/var/www/jituo/
```

### 服务器端更新

```bash
cd /var/www/jituo

# 安装新增依赖（如有）
pnpm install

# 重新构建（按需选择）
pnpm --filter backend build
pnpm --filter jituo-frontend build
pnpm --filter admin build

# 数据库迁移（仅 schema 有变更时执行）
cd backend && pnpm prisma migrate deploy && cd ..

# 重启后端
pm2 restart jituo-api

# 重载 Nginx（仅 nginx 配置有变更时）
sudo nginx -t && sudo systemctl reload nginx
```

---

## 13. 常见问题排查

### 502 Bad Gateway
```bash
# 检查后端是否在运行
pm2 status
pm2 logs jituo-api --lines 30

# 检查 3000 端口是否监听
ss -tlnp | grep 3000

# 重启后端
pm2 restart jituo-api
```

### 数据库连接失败
```bash
# 检查 PostgreSQL 状态
sudo systemctl status postgresql

# 测试连接
psql -U jituo -d jituo_prod -h localhost -c "SELECT 1;"

# 检查 .env 中 DATABASE_URL 密码是否正确
cat /var/www/jituo/backend/.env | grep DATABASE_URL
```

### Nginx 配置报错
```bash
sudo nginx -t
# 查看详细错误信息，按提示修复

sudo journalctl -u nginx -n 50
```

### SSL 证书续期测试
```bash
sudo certbot renew --dry-run
```

### 查看实时日志
```bash
pm2 logs jituo-api          # 后端实时日志
sudo tail -f /var/log/nginx/error.log   # Nginx 错误
sudo tail -f /var/log/nginx/access.log  # Nginx 访问
```

### 磁盘/内存检查
```bash
df -h          # 磁盘空间
free -h        # 内存
pm2 monit      # 进程资源占用实时监控
```

---

## 附：目录结构参考

```
/var/www/jituo/
├── backend/
│   ├── dist/          ← tsc 编译产物（backend build 生成）
│   ├── prisma/
│   ├── src/
│   └── .env           ← 生产环境变量（chmod 600）
├── frontend/
│   └── dist/          ← vite build 产物（nginx 静态文件根目录）
├── admin/
│   └── dist/          ← vite build 产物（nginx /admin/ 路径）
├── ecosystem.config.js
└── package.json

/var/log/jituo/
├── out.log            ← 后端标准输出
└── error.log          ← 后端错误输出
```
