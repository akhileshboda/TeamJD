const path = require('path');
const { sendStaticPage } = require('../utils/staticPages');
const { getAdmin } = require('./adminAuth');
const { getCmsStore } = require('../services/cmsStore');

const publicDir = path.join(__dirname, '..', '..', 'public');
const MAINTENANCE_PAGE_PATH = path.join(publicDir, '503.html');
const MAINTENANCE_RETRY_AFTER_SECONDS = 3600;
const EXEMPT_PATHS = new Set(['/healthz']);

function isProductionRuntime(env = process.env) {
  return env.NODE_ENV === 'production' && env.APP_ENV !== 'staging';
}

// The dashboard's Settings > Site visibility wins; 'default' follows .env.
function isMaintenanceModeEnabled(env = process.env, settings = getCmsStore().cachedSettings()) {
  const visibility = settings?.site?.visibility;
  if (visibility === 'live') return false;
  if (visibility === 'maintenance') return true;
  return isMaintenanceModeEnabledByEnv(env);
}

function isMaintenanceModeEnabledByEnv(env = process.env) {
  if (env.MAINTENANCE_MODE === 'true') return true;
  if (env.MAINTENANCE_MODE === 'false') return false;
  return isProductionRuntime(env);
}

// The dashboard stays reachable while the public site is gated so Jake can load
// his content before launch; its API has its own sign-in.
const EXEMPT_PREFIXES = ['/assets', '/admin', '/api/admin'];

function isExemptPath(requestPath) {
  return (
    EXEMPT_PATHS.has(requestPath) ||
    EXEMPT_PREFIXES.some((prefix) => requestPath === prefix || requestPath.startsWith(`${prefix}/`))
  );
}

let hasLoggedActiveState = false;

function maintenanceMode(req, res, next) {
  if (!isMaintenanceModeEnabled()) {
    return next();
  }

  if (!hasLoggedActiveState) {
    hasLoggedActiveState = true;
    console.log('[maintenance] gate is ACTIVE. Turn it off in the dashboard (Settings > Site visibility) or set MAINTENANCE_MODE=false in .env and restart.');
  }

  // Signed-in admins see the real site behind the gate: dashboard previews and
  // pre-launch checks. Needs express-session to run before this middleware.
  if (isExemptPath(req.path) || getAdmin(req)) {
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
  isMaintenanceModeEnabledByEnv,
  isProductionRuntime
};
