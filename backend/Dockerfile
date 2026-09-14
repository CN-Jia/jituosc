# 极拓空间 Backend Dockerfile
# 从项目根目录构建: docker build -f backend/Dockerfile -t jituo-backend .

FROM node:20-slim

RUN corepack enable && corepack prepare pnpm@10 --activate

# Debian 原生模块编译依赖（bcrypt）+ Prisma OpenSSL
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# pnpm workspace 配置（利用 Docker 缓存：先拷贝包管理文件）
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json backend/tsconfig.json backend/

# 安装全部依赖（含 devDependencies）
RUN pnpm install --frozen-lockfile

# 复制后端源码 + Prisma schema
COPY backend/src backend/src/
COPY backend/prisma backend/prisma/

# 生成 Prisma Client + 编译 TypeScript
RUN pnpm --filter backend db:generate
RUN pnpm --filter backend build

# 清理 devDependencies 减小镜像体积（可选，跳过以简化维护）
# RUN pnpm install --frozen-lockfile --prod --filter backend

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health',r=>{process.exit(r.statusCode===200?0:1)})"

ENTRYPOINT ["node", "backend/dist/app.js"]
