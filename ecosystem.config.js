module.exports = {
  apps: [
    {
      name: 'jituo-api',
      script: './dist/app.js',
      cwd: '/var/www/jituo/backend',
      instances: 1,
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
