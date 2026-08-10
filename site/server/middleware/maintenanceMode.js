const path = require('path');
const { sendStaticPage } = require('../utils/staticPages');

const publicDir = path.join(__dirname, '..', '..', 'public');
const MAINTENANCE_PAGE_PATH = path.join(publicDir, '503.html');
const MAINTENANCE_RETRY_AFTER_SECONDS = 3600;
const EXEMPT_PATHS = new Set(['/healthz']);

function isProductionRuntime(env = process.env) {
  return env.NODE_ENV === 'production' && env.APP_ENV !== 'staging';
}

function isMaintenanceModeEnabled(env = process.env) {
  if (env.MAINTENANCE_MODE === 'true') return true;
  if (env.MAINTENANCE_MODE === 'false') return false;
  return isProductionRuntime(env);
}

function isExemptPath(requestPath) {
  return EXEMPT_PATHS.has(requestPath) || requestPath === '/assets' || requestPath.startsWith('/assets/');
}

let hasLoggedActiveState = false;

function maintenanceMode(req, res, next) {
  if (!isMaintenanceModeEnabled()) {
    return next();
  }

  if (!hasLoggedActiveState) {
    hasLoggedActiveState = true;
    console.log('[maintenance] gate is ACTIVE — set MAINTENANCE_MODE=false in .env and restart to disable.');
  }

  if (isExemptPath(req.path)) {
    return next();
  }

  res.set('Retry-After', String(MAINTENANCE_RETRY_AFTER_SECONDS));

  if (req.path.startsWith('/api/')) {
    res.set('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'Site is temporarily unavailable.' });
  }

  return sendStaticPage(res, {
    statusCode: 503,
    filePath: MAINTENANCE_PAGE_PATH,
    fallbackMessage: 'Site is temporarily unavailable.',
    cacheControl: 'no-store'
  });
}

module.exports = {
  maintenanceMode,
  isMaintenanceModeEnabled,
  isProductionRuntime
};
