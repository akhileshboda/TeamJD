const crypto = require('crypto');
const { getAdmin } = require('./adminAuth');

// The staging gate: a username and password screen in front of the whole public
// site, so only invited people see work in progress. It was removed in July 2026
// (commit 386c8e1) and restored, now scoped to staging and enforced server-side.
//
// On by default only on staging (APP_ENV=staging). SITE_AUTH_ENABLED=true|false
// overrides that either way. Production never defaults on: its .env has no
// gate accounts, so a default-on gate there would lock everyone out at launch.
function isGateEnabled(env = process.env) {
  if (env.SITE_AUTH_ENABLED === 'true') return true;
  if (env.SITE_AUTH_ENABLED === 'false') return false;
  return env.APP_ENV === 'staging';
}

// Accounts come from the environment so passwords never reach the browser.
// Both roles unlock the same site.
function getAccounts(env = process.env) {
  return [
    { role: 'client', username: env.SITE_AUTH_CLIENT_USER, password: env.SITE_AUTH_CLIENT_PASS },
    { role: 'admin', username: env.SITE_AUTH_ADMIN_USER, password: env.SITE_AUTH_ADMIN_PASS }
  ].filter((account) => account.username && account.password);
}

// Constant-time compare over fixed-length digests, so neither the value length
// nor an early mismatch leaks through timing.
function safeEqual(a, b) {
  const aHash = crypto.createHash('sha256').update(String(a)).digest();
  const bHash = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

function findAccount(username, password, env = process.env) {
  if (typeof username !== 'string' || typeof password !== 'string') return null;
  // Every account is checked (no early return) to keep the timing uniform.
  let matched = null;
  for (const account of getAccounts(env)) {
    const userOk = safeEqual(username, account.username);
    const passOk = safeEqual(password, account.password);
    if (userOk && passOk) matched = { role: account.role, username: account.username };
  }
  return matched;
}

// Signed in through the gate, or through the dashboard (whose previews show the
// public site, and which has its own sign-in).
function isSignedIn(req) {
  return Boolean(req.session?.siteAuth?.authed || getAdmin(req));
}

// APIs a gated visitor may still use: the gate's own sign-in, and the dashboard,
// which has its own. Everything else under /api (content, images, enquiries,
// visit counting) waits until they sign in.
const OPEN_API_PREFIXES = ['/api/auth', '/api/admin'];

const isOpenApi = (requestPath) => OPEN_API_PREFIXES.some((prefix) => requestPath === prefix || requestPath.startsWith(`${prefix}/`));

// Pages and static files still load, so the browser can show the sign-in
// screen; with the APIs closed, the site behind it has no content or photos.
// Needs express-session to run first.
function siteGate(req, res, next) {
  if (!isGateEnabled()) return next();
  res.set('X-Robots-Tag', 'noindex, nofollow');
  if (isSignedIn(req) || !req.path.startsWith('/api/') || isOpenApi(req.path)) return next();
  res.set('Cache-Control', 'no-store');
  return res.status(401).json({ error: 'Sign in to view this site.' });
}

module.exports = { findAccount, isGateEnabled, isSignedIn, siteGate };
