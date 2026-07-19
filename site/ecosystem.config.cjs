module.exports = {
  apps: [
    {
      name: 'jake-production',
      cwd: __dirname,
      script: 'server/app.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      min_uptime: '10s',
      max_restarts: 10,
      exp_backoff_restart_delay: 100,
      max_memory_restart: '300M',
      kill_timeout: 10000,
      time: true,
      out_file: '/home/ubuntu/.pm2/logs/jake-production-out.log',
      error_file: '/home/ubuntu/.pm2/logs/jake-production-error.log',
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '3000'
      }
    }
  ]
};
