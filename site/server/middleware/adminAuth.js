const { isDevBypass } = require('../services/adminAuth');

// Guards for the dashboard API. Sessions come from express-session (app.js), so
// these must be mounted after it.

function getAdmin(req, env = process.env) {
  if (isDevBypass(env)) return { email: 'dev@localhost' };
  const admin = req.session?.admin;
  return admin?.email ? admin : null;
}

function requireAdmin({ env } = {}) {
  return function adminOnly(req, res, next) {
    res.set('Cache-Control', 'no-store');
    const admin = getAdmin(req, env);
    if (!admin) return res.status(401).json({ error: 'Please sign in to continue.', code: 'SIGNED_OUT' });
    req.admin = admin;
    return next();
  };
}

function hostOf(value) {
  try {
    return new URL(value).host;
  } catch (_error) {
    return null;
  }
}

// CSRF defence for cookie-authenticated writes: browsers always label where a
// request came from, so anything not from this site is refused. Requests with no
// provenance at all (scripts) are refused too; the dashboard is browser-only.
function requireSameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const fetchSite = req.get('sec-fetch-site');
  if (fetchSite) {
    if (fetchSite === 'same-origin' || fetchSite === 'none') return next();
    return res.status(403).json({ error: 'This request was blocked for your security. Reload the page and try again.' });
  }

  const origin = hostOf(req.get('origin'));
  const allowed = [req.get('host'), hostOf(process.env.PUBLIC_BASE_URL)].filter(Boolean);
  if (origin && allowed.includes(origin)) return next();
  return res.status(403).json({ error: 'This request was blocked for your security. Reload the page and try again.' });
}

module.exports = { getAdmin, requireAdmin, requireSameOrigin };
