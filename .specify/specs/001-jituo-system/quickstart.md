# Quickstart: 极拓空间 本地开发启动指南

**前提**：已安装 Node.js 20+、pnpm、Docker Desktop

---

## 1. 克隆项目并安装依赖

```bash
git clone <your-repo-url> jituo
cd jituo
pnpm install   # 安装所有 workspace 依赖
```

---

## 2. 启动 PostgreSQL（Docker）

```bash
docker run -d \
  --name jituo-postgres \
  -e POSTGRES_USER=jituo \
  -e POSTGRES_PASSWORD=jiao0924 \
  -e POSTGRES_DB=jituo_dev \
  -p 5432:5432 \
  postgres:16
```

---

## 3. 配置环境变量

```bash
cd backend
cp .env.example .env
```

编辑 `.env`，最少需要填写：

```bash
DATABASE_URL="postgresql://jituo:jiao0924@localhost:5432/jituo_dev"
JWT_SECRET="dev-secret-key-change-in-prod"
SERVERCHAN_TOKEN="你的Server酱Token"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD_HASH=""   # 见下方生成方法
ADMIN_WECHAT_ID="Jt--04"
```

**生成管理员密码 Hash**：
```bash
node -e "const bcrypt=require('bcrypt'); bcrypt.hash('your_password',10).then(console.log)"
```

---

## 4. 初始化数据库

```bash
cd backend
pnpm prisma migrate dev --name init
pnpm prisma generate
pnpm prisma db seed    # 插入默认需求类型
```

---

## 5. 启动后端 API

```bash
pnpm --filter backend dev
# API 运行在 http://localhost:3000
# 访问 http://localhost:3000/health 验证
```

---

## 6. 启动 PC 用户端

```bash
pnpm --filter jituo-frontend dev
# 访问 http://localhost:5173
```

---

## 7. 启动管理后台

```bash
pnpm --filter jituo-admin dev
# 访问 http://localhost:5174
# 用 ADMIN_USERNAME / 你设置的密码 登录
```

---

## 8. 验证整体流程

1. 打开 `http://localhost:5173`，在首页输入微信号登录，提交一条测试需求
2. 打开 `http://localhost:5174`，查看新订单并更改状态
3. 回到用户端订单详情，验证状态时间线已更新

---

## 常用命令速查

```bash
# 后端
pnpm --filter backend dev          # 开发模式（热重载）
pnpm --filter backend build        # 编译生产版本
pnpm --filter backend prisma:studio # 可视化数据库管理界面

# PC 用户端
pnpm --filter jituo-frontend dev   # 开发模式
pnpm --filter jituo-frontend build # 编译生产版本

# 管理后台
pnpm --filter jituo-admin dev      # 开发模式
pnpm --filter jituo-admin build    # 编译生产版本
```
