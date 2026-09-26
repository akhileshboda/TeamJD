const crypto = require('crypto');

// Cloudflare Access sits in front of /admin and /api/admin at the edge. The origin
// still verifies the signed token Access attaches to every request, so a request
// that reaches Express some other way (misrouted tunnel, disabled policy) is refused.
// https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/

const TOKEN_HEADER = 'Cf-Access-Jwt-Assertion';
const KEYS_TTL_MS = 60 * 60 * 1000;
// A forged token with an unknown kid must not trigger a certs fetch on every request.
const FORCED_REFRESH_MIN_MS = 60 * 1000;
const CLOCK_SKEW_SECONDS = 60;

let keyCache = { teamDomain: null, keys: [], fetchedAt: 0 };

class AccessDeniedError extends Error {}

function getAccessConfig(env = process.env) {
  return {
    teamDomain: String(env.CF_ACCESS_TEAM_DOMAIN || '')
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, ''),
    audience: env.CF_ACCESS_AUD || '',
    allowedEmails: String(env.CMS_ADMIN_EMAILS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
    // Never honoured in production -- that includes staging, which runs NODE_ENV=production.
    devBypass: env.NODE_ENV !== 'production' && env.CMS_DEV_BYPASS === 'true'
  };
}

async function getSigningKeys(teamDomain, { fetchImpl = fetch, force = false } = {}) {
  const age = keyCache.teamDomain === teamDomain ? Date.now() - keyCache.fetchedAt : Infinity;
  if (age < (force ? FORCED_REFRESH_MIN_MS : KEYS_TTL_MS)) return keyCache.keys;

  const response = await fetchImpl(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error(`Access certs request failed with ${response.status}`);
  const { keys = [] } = await response.json();
  keyCache = { teamDomain, keys, fetchedAt: Date.now() };
  return keys;
}

function decodeSegment(segment) {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

async function verifyAccessToken(token, config, { fetchImpl, now = Date.now() } = {}) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new AccessDeniedError('Malformed token.');

  let header;
  let payload;
  try {
    header = decodeSegment(parts[0]);
    payload = decodeSegment(parts[1]);
  } catch (error) {
    throw new AccessDeniedError('Malformed token.');
  }
  if (header.alg !== 'RS256') throw new AccessDeniedError('Unexpected token algorithm.');

  let keys = await getSigningKeys(config.teamDomain, { fetchImpl });
  let jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) {
    // Access rotates its signing keys; refetch once before rejecting an unknown kid.
    keys = await getSigningKeys(config.teamDomain, { fetchImpl, force: true });
    jwk = keys.find((key) => key.kid === header.kid);
  }
  if (!jwk) throw new AccessDeniedError('Unknown signing key.');

  const signatureValid = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    crypto.createPublicKey({ key: jwk, format: 'jwk' }),
    Buffer.from(parts[2], 'base64url')
  );
  if (!signatureValid) throw new AccessDeniedError('Invalid token signature.');

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(config.audience)) throw new AccessDeniedError('Token audience mismatch.');
  if (payload.iss !== `https://${config.teamDomain}`) throw new AccessDeniedError('Token issuer mismatch.');

  const nowSeconds = now / 1000;
  if (!payload.exp || payload.exp < nowSeconds - CLOCK_SKEW_SECONDS) throw new AccessDeniedError('Token expired.');
  if (payload.nbf && payload.nbf > nowSeconds + CLOCK_SKEW_SECONDS) throw new AccessDeniedError('Token not yet valid.');

  const email = String(payload.email || '').toLowerCase();
  if (config.allowedEmails.length && !config.allowedEmails.includes(email)) {
    throw new AccessDeniedError('This account is not allowed to manage media.');
  }

  return { email };
}

function requireCmsAccess(options = {}) {
  return async function cmsAccess(req, res, next) {
    const config = getAccessConfig(options.env);
    res.set('Cache-Control', 'no-store');

    if (config.devBypass) {
      req.cmsUser = { email: 'dev@localhost' };
      return next();
    }

    if (!config.teamDomain || !config.audience) {
      return res.status(503).json({ error: 'The media manager is not set up on this server yet.' });
    }

    const token = req.get(TOKEN_HEADER);
    if (!token) return res.status(401).json({ error: 'Please sign in to manage media.' });

    try {
      req.cmsUser = await verifyAccessToken(token, config, { fetchImpl: options.fetchImpl });
      return next();
    } catch (error) {
      if (error instanceof AccessDeniedError) {
        return res.status(401).json({ error: 'Your sign-in could not be verified. Please sign in again.' });
      }
      console.error('[cms] Access verification failed:', error.message);
      return res.status(503).json({ error: 'Sign-in could not be checked right now. Try again shortly.' });
    }
  };
}

function resetKeyCache() {
  keyCache = { teamDomain: null, keys: [], fetchedAt: 0 };
}

module.exports = {
  getAccessConfig,
  requireCmsAccess,
  resetKeyCache
};
