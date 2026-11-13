const path = require('path');
const { sendStaticPage } = require('../utils/staticPages');
const { getAdmin } = require('./adminAuth');
const { getCmsStore } = require('../services/cmsStore');

const publicDir = path.join(__dirname, '..', '..', 'public');
const MAINTENANCE_PAGE_PATH = path.join(publicDir, '503.html');
const MAINTENANCE_RETRY_AFTER_SECONDS = 3600;
// The favicon is the public logo mark; the sign-in page needs it before sign-in.
// The crawl files stay reachable so search engines keep finding the site while
// it is in maintenance; the homepage itself is handled by renderHoldingPage.
const EXEMPT_PATHS = new Set([
  '/healthz',
  '/favicon.png',
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
  '/llms-full.txt'
]);

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

function sendMaintenanceResponse(req, res) {
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

// renderHoldingPage(req) returns the maintenance page as indexable HTML for the
// homepage, so the site stays discoverable in search while gated. Everyone gets
// the same page; inner pages and the API keep returning 503.
function createMaintenanceMode({ renderHoldingPage } = {}) {
  return async function maintenanceMode(req, res, next) {
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

    if (renderHoldingPage && req.path === '/' && (req.method === 'GET' || req.method === 'HEAD')) {
      try {
        const html = await renderHoldingPage(req);
        res.status(200).set('Cache-Control', 'no-cache').type('text/html; charset=utf-8');
        return res.send(req.method === 'HEAD' ? '' : html);
      } catch (error) {
        console.error('[maintenance] holding page failed, serving 503:', error);
      }
    }

    return sendMaintenanceResponse(req, res);
  };
}

const maintenanceMode = createMaintenanceMode();

module.exports = {
  MAINTENANCE_PAGE_PATH,
  createMaintenanceMode,
  maintenanceMode,
  isMaintenanceModeEnabled,
  isMaintenanceModeEnabledByEnv,
  isProductionRuntime
};
