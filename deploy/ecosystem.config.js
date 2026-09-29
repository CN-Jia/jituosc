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
