// PM2 apps. Process names and ports are host-specific, so they come from the
// environment (deploy.sh exports them from the git-ignored deploy.env; see
// deploy.env.example). An app is only defined when its name and port are set.
// Logs use PM2's default location ($PM2_HOME/logs/<name>-{out,error}.log).

const shared = {
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
  time: true
};

const apps = [];

if (process.env.TEAMJD_PRODUCTION_PM2_NAME && process.env.TEAMJD_PRODUCTION_PORT) {
  apps.push({
    ...shared,
    name: process.env.TEAMJD_PRODUCTION_PM2_NAME,
    env: {
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: process.env.TEAMJD_PRODUCTION_PORT
    }
  });
}

if (process.env.TEAMJD_STAGING_PM2_NAME && process.env.TEAMJD_STAGING_PORT) {
  apps.push({
    ...shared,
    name: process.env.TEAMJD_STAGING_PM2_NAME,
    env: {
      NODE_ENV: 'production',
      APP_ENV: 'staging',
      HOST: '127.0.0.1',
      PORT: process.env.TEAMJD_STAGING_PORT,
      ASSET_AUTO_SYNC_ENABLED: 'false',
      ASSET_SYNC_ON_BOOT: 'false'
    }
  });
}

module.exports = { apps };
