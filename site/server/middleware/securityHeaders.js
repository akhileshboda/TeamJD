// Baseline response headers for every route. No Content-Security-Policy yet: the
// site embeds YouTube, Turnstile, Typeform and Google Fonts, so a policy needs its
// own tested allowlist rather than a guess. HSTS belongs at the Cloudflare edge.
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()'
};

function securityHeaders(req, res, next) {
  res.set(SECURITY_HEADERS);
  next();
}

module.exports = { SECURITY_HEADERS, securityHeaders };
