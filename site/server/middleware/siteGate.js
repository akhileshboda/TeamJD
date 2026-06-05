const crypto = require('crypto');
const path = require('path');
const { logVisit } = require('../services/visitLog');

// ── Gate toggle ──────────────────────────────────────────────
// On in staging/prod, off in local dev. An explicit SITE_AUTH_ENABLED
// flag overrides the NODE_ENV default either way (useful for testing a
// production build locally, or temporarily opening up staging).
function isGateEnabled() {
  const flag = process.env.SITE_AUTH_ENABLED;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return process.env.NODE_ENV !== 'development';
}

// ── Credentials ──────────────────────────────────────────────
// Accounts are read from the environment so the passwords are never
// shipped to the browser. Both roles unlock the same site; the role is
// only recorded in the visit log.
function getAccounts() {
  return [
    {
      role: 'client',
      username: process.env.SITE_AUTH_CLIENT_USER,
      password: process.env.SITE_AUTH_CLIENT_PASS
    },
    {
      role: 'admin',
      username: process.env.SITE_AUTH_ADMIN_USER,
      password: process.env.SITE_AUTH_ADMIN_PASS
    }
  ].filter((account) => account.username && account.password);
}

// Constant-time compare over fixed-length digests, so neither the value
// length nor an early mismatch leaks via timing.
function safeEqual(a, b) {
  const aHash = crypto.createHash('sha256').update(String(a)).digest();
  const bHash = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

function findAccount(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') {
    return null;
  }

  // Check every account (no early return) to keep timing uniform.
  let matched = null;
  for (const account of getAccounts()) {
    const userOk = safeEqual(username, account.username);
    const passOk = safeEqual(password, account.password);
    if (userOk && passOk) {
      matched = { role: account.role, username: account.username };
    }
  }
  return matched;
}

// ── Asset guard (Hybrid enforcement) ─────────────────────────
// When the gate is on and the visitor is not authenticated, withhold all
// media/data under /api/assets EXCEPT the brand logo + favicon, which the
// login screen needs to render. The SPA shell and JS/CSS bundle are served
// normally, so React still boots and shows the frosted overlay.
function gateAssets(req, res, next) {
  if (!isGateEnabled()) return next();
  if (req.session?.siteAuth?.authed) return next();
  if (req.path === '/logo' || req.path === '/logo-mark') return next();
  return res.status(401).json({ error: 'Authentication required' });
}

// ── Visit logging + noindex ──────────────────────────────────
function isPageView(req) {
  if (req.method !== 'GET') return false;
  const ext = path.extname(req.path);
  if (ext && ext !== '.html') return false; // skip assets, js, css, etc.
  return Boolean(req.accepts('html'));
}

function visitLogger(req, res, next) {
  // Keep the staging site out of search indexes while gated.
  if (isGateEnabled()) {
    res.set('X-Robots-Tag', 'noindex, nofollow');
  }

  if (isPageView(req)) {
    logVisit({
      type: 'visit',
      ip: req.ip,
      method: req.method,
      path: req.originalUrl || req.url,
      ua: req.get('user-agent') || null,
      role: req.session?.siteAuth?.role || null,
      authed: Boolean(req.session?.siteAuth?.authed)
    });
  }

  next();
}

module.exports = { isGateEnabled, findAccount, gateAssets, visitLogger };
