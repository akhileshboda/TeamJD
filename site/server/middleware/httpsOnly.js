const { isLoopback } = require('./clientIp');

// HTTPS backstop behind the Cloudflare tunnel. Cloudflare's "Always Use HTTPS"
// and HSTS settings should do this at the edge; this keeps visitors on HTTPS even
// if those settings are ever switched off.
//
// The visitor's scheme comes from Cloudflare (CF-Visitor, then X-Forwarded-Proto)
// and is only trusted from the local tunnel (a loopback peer), like clientIp.js.
// Requests without those headers (local curl, /healthz checks) pass untouched.

const HSTS_VALUE = 'max-age=15552000'; // 180 days; subdomains are left to Cloudflare.

function visitorScheme(req) {
  const peer = req.socket?.remoteAddress || '';
  if (!isLoopback(peer)) return null;

  const visitor = req.get('CF-Visitor');
  if (visitor) {
    try {
      const scheme = JSON.parse(visitor)?.scheme;
      if (scheme === 'http' || scheme === 'https') return scheme;
    } catch (_error) {
      // fall through to X-Forwarded-Proto
    }
  }

  const forwarded = String(req.get('X-Forwarded-Proto') || '').split(',')[0].trim().toLowerCase();
  return forwarded === 'http' || forwarded === 'https' ? forwarded : null;
}

function createHttpsOnly({ env = process.env } = {}) {
  let canonicalOrigin = null;
  try {
    const url = new URL(env.PUBLIC_BASE_URL || '');
    if (url.protocol === 'https:') canonicalOrigin = url.origin;
  } catch (_error) {
    canonicalOrigin = null;
  }
  const enabled = env.NODE_ENV === 'production' && Boolean(canonicalOrigin);

  return function httpsOnly(req, res, next) {
    if (!enabled) return next();
    const scheme = visitorScheme(req);

    if (scheme === 'https') {
      res.set('Strict-Transport-Security', HSTS_VALUE);
      return next();
    }

    if (scheme === 'http') {
      // Redirect to the configured origin, never to the request's Host header,
      // so a forged Host can't turn this into an open redirect.
      const status = req.method === 'GET' || req.method === 'HEAD' ? 301 : 308;
      return res.redirect(status, `${canonicalOrigin}${req.originalUrl}`);
    }

    return next();
  };
}

module.exports = { HSTS_VALUE, createHttpsOnly, visitorScheme };
