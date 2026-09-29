// PM2 配置 —— ⚠️ 备用部署方案（传统 Node.js 部署），**不是当前的生产方案**。
//
// 生产环境使用 Docker Compose：见 docker-compose.prod.yml 与 .github/workflows/deploy.yml。
// 本文件保留用于「不使用容器」的场景：宿主机 Nginx + PM2，完整步骤见 deploy/DEPLOY.md。
//
// 使用前提：
//   1. 已在项目根执行 pnpm install && pnpm build:backend（script 指向 backend/dist/app.js）
//   2. 后端 .env 已就绪（cwd 是项目根，dotenv 从进程 cwd 读取）
//   3. 已停掉 Docker 方案：docker compose -f docker-compose.prod.yml down
//      —— 两套方式都占用 3000（以及 Nginx 的 80/443），同时只能启用一套
//
// 启动：pm2 start deploy/ecosystem.config.js --env production   （env_production 必须带 --env）
// 停止：pm2 delete jituo-api

module.exports = {
  apps: [
    {
      name: 'jituo-api',
      script: './backend/dist/app.js',
      cwd: '/var/www/jituo',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '512M',
      error_file: '/var/log/jituo/error.log',
      out_file: '/var/log/jituo/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
}
