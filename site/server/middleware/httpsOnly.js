const { isLoopback } = require('./clientIp');

// HTTPS backstop behind the Cloudflare tunnel. Cloudflare's "Always Use HTTPS"
// and HSTS settings should do this at the edge; this keeps visitors on HTTPS even
// if those settings are ever switched off.
//
// The visitor's scheme comes from Cloudflare (CF-Visitor, then X-Forwarded-Proto)
// and is only trusted from the local tunnel (a loopback peer), like clientIp.js.
// Requests without those headers (local curl, /healthz checks) pass untouched.
//
// It also folds duplicate page URLs into the one Google should index, with a
// single 301: the www twin of the canonical host, a trailing slash (/about/)
// and a literal /index.html. Each of those used to serve a 200 copy whose
// canonical tag pointed elsewhere, which Search Console reports as "Alternative
// page with proper canonical tag".

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

function hostWithoutPort(req) {
  return String(req.get('Host') || '').toLowerCase().replace(/:\d+$/, '');
}

// Only the www/bare twin counts as an alternate host. Any other Host (for
// example one the tunnel rewrites) passes through, so this can never loop.
function isTwinHost(host, canonicalHost) {
  return host === `www.${canonicalHost}` || `www.${host}` === canonicalHost;
}

// /about/ -> /about, /index.html -> /, /services/index.html -> /services.
// API routes keep their exact paths.
function canonicalPath(pathname) {
  if (pathname === '/api' || pathname.startsWith('/api/')) return pathname;
  let next = pathname.replace(/\/index\.html$/i, '/');
  if (next.length > 1) next = next.replace(/\/+$/, '') || '/';
  return next;
}

function createHttpsOnly({ env = process.env } = {}) {
  let canonicalOrigin = null;
  let canonicalHost = null;
  try {
    const url = new URL(env.PUBLIC_BASE_URL || '');
    if (url.protocol === 'https:') {
      canonicalOrigin = url.origin;
      canonicalHost = url.hostname.toLowerCase();
    }
  } catch (_error) {
    canonicalOrigin = null;
  }
  const enabled = env.NODE_ENV === 'production' && Boolean(canonicalOrigin);

  return function httpsOnly(req, res, next) {
    if (!enabled) return next();
    const scheme = visitorScheme(req);
    if (!scheme) return next();

    const isRead = req.method === 'GET' || req.method === 'HEAD';
    const [pathname, query] = splitUrl(req.originalUrl);
    const tidyPath = isRead ? canonicalPath(pathname) : pathname;

    // Redirect to the configured origin, never to the request's Host header,
    // so a forged Host can't turn this into an open redirect.
    if (scheme === 'http') {
      return res.redirect(isRead ? 301 : 308, `${canonicalOrigin}${tidyPath}${query}`);
    }

    if (isRead && (tidyPath !== pathname || isTwinHost(hostWithoutPort(req), canonicalHost))) {
      return res.redirect(301, `${canonicalOrigin}${tidyPath}${query}`);
    }

    res.set('Strict-Transport-Security', HSTS_VALUE);
    return next();
  };
}

function splitUrl(originalUrl) {
  const index = originalUrl.indexOf('?');
  return index === -1 ? [originalUrl, ''] : [originalUrl.slice(0, index), originalUrl.slice(index)];
}

module.exports = { HSTS_VALUE, canonicalPath, createHttpsOnly, visitorScheme };
