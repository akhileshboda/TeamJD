// Baseline response headers for every route. HSTS belongs at the Cloudflare edge.
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  // Isolates the browsing context from cross-origin windows (no popups are used).
  'Cross-Origin-Opener-Policy': 'same-origin'
};

// Content-Security-Policy. It ships as Report-Only: violations show in the browser
// console (open DevTools while clicking through every page on staging) without
// breaking anything. Set CSP_ENFORCE=true once a full pass is clean.
//
// Allowlist, from what the site really loads:
//   Cloudflare Turnstile (script, frame, connect), YouTube nocookie (contact reel),
//   Google Fonts (CSS + files), and the R2 media host for photos and video.
// 'unsafe-inline' for styles is needed by React inline styles and motion.
// The sha256 hash allows the one inline script in client/index.html (about-page
// hero preload). If that script changes, rebuild and replace the hash from
// dist/index.html. Never add inline event handlers (onload="...") to HTML: hashes
// don't cover them, so an enforced policy blocks them (the font loader once did).
const INLINE_SCRIPT_HASH = "'sha256-ErUipctiYFhuQWesdatFR5031XtU7mIl+6G8r1XoFM8='";

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch (_error) {
    return null;
  }
}

function buildContentSecurityPolicy(env = process.env) {
  const media = ["'self'", originOf(env.R2_PUBLIC_BASE_URL)].filter(Boolean);
  return [
    "default-src 'self'",
    `script-src 'self' ${INLINE_SCRIPT_HASH} https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `img-src ${media.join(' ')} data: blob:`,
    `media-src ${media.join(' ')} blob:`,
    "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://challenges.cloudflare.com",
    "connect-src 'self' https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'"
  ].join('; ');
}

// Built on the first request, not at require time: app.js loads this module
// before dotenv has read R2_PUBLIC_BASE_URL.
let cachedCsp;

function securityHeaders(req, res, next) {
  res.set(SECURITY_HEADERS);
  cachedCsp = cachedCsp || buildContentSecurityPolicy();
  const header = process.env.CSP_ENFORCE === 'true'
    ? 'Content-Security-Policy'
    : 'Content-Security-Policy-Report-Only';
  res.set(header, cachedCsp);
  next();
}

module.exports = { SECURITY_HEADERS, buildContentSecurityPolicy, securityHeaders };
