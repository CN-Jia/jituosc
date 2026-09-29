# 极拓空间 Backend Dockerfile — 多阶段构建
#
# 生产（默认目标 = 最后一个 stage，deploy.yml 与 docker-compose.prod.yml 用）:
#   docker build -f backend/Dockerfile -t jituo-backend .
# 开发（tsx watch + 源码 bind mount，docker-compose.dev.yml 用）:
#   docker build -f backend/Dockerfile --target dev -t jituo-backend:dev .

# ── Stage: base —— 依赖安装（dev / build / production 共用）──────
FROM node:20-slim AS base

RUN corepack enable && corepack prepare pnpm@10 --activate

# Debian 原生模块编译依赖（bcrypt）+ Prisma OpenSSL
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# pnpm workspace 配置（利用 Docker 缓存：先拷贝包管理文件）
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json backend/tsconfig.json backend/

# 安装全部依赖（含 devDependencies，dev 阶段需要 tsx）
RUN pnpm install --frozen-lockfile

# Prisma Client 生成到 node_modules，运行时必需
COPY backend/prisma backend/prisma/
RUN pnpm --filter backend db:generate

# ── Stage: dev —— 开发运行（tsx 热重载）────────────────────────
# 源码由 docker-compose.dev.yml 以只读卷挂载进来，改代码即时生效，无需重建镜像。
#
# ⚠️ 必须通过 pnpm 跑包脚本，不能写 `npx tsx`：
#    仓库根的 node_modules 里没有包（pnpm workspace 只把根依赖链接到根 .bin），
#    tsx 的可执行文件在 backend/node_modules/.bin —— 从 /app 执行 npx tsx 会解析失败。
FROM base AS dev

ENV NODE_ENV=development
ENV PORT=3000

EXPOSE 3000

CMD ["pnpm", "--filter", "backend", "dev"]

# ── Stage: build —— 编译 TypeScript ───────────────────────────
FROM base AS build

COPY backend/src backend/src/
RUN pnpm --filter backend build

# ── Stage: production —— 运行编译产物（默认构建目标）────────────
FROM base AS production

# 只补编译产物：依赖与 Prisma Client 已由 base 提供
COPY --from=build /app/backend/dist backend/dist/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health',r=>{process.exit(r.statusCode===200?0:1)})"

ENTRYPOINT ["node", "backend/dist/app.js"]
