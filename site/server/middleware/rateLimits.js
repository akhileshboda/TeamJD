const crypto = require('crypto');
const { ipKeyGenerator, rateLimit } = require('express-rate-limit');
const { getClientIp } = require('./clientIp');

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const RATE_LIMIT_POLICIES = Object.freeze({
  enquiryAttempt: { windowMs: 15 * MINUTE, limit: 5 },
  enquiryEmail: { windowMs: DAY, limit: 3 },
  enquiryGlobal: { windowMs: DAY, limit: 40 },
  publicAsset: { windowMs: 5 * MINUTE, limit: 300 },
  genericApi: { windowMs: 5 * MINUTE, limit: 120 },
  dropboxOAuth: { windowMs: 15 * MINUTE, limit: 10 },
  adminAttempt: { windowMs: 15 * MINUTE, limit: 10 },
  manualOperation: { windowMs: 15 * MINUTE, limit: 3 }
});

function clientKey(req) {
  const ip = getClientIp(req);
  return ip === 'unknown' ? ip : ipKeyGenerator(ip);
}

function jsonRateLimit(options) {
  const code = options.code || 'RATE_LIMITED';
  const message = options.message || 'Too many requests. Please try again later.';

  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: options.keyGenerator || clientKey,
    skip: options.skip,
    skipFailedRequests: options.skipFailedRequests || false,
    requestWasSuccessful: options.requestWasSuccessful,
    handler(req, res) {
      return res.status(429).json({
        ok: false,
        error: { code, message }
      });
    }
  });
}

function normalizedEmailKey(req) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const secret = process.env.SESSION_SECRET || 'team-jd-unconfigured-session-secret';
  return crypto.createHmac('sha256', secret).update(email).digest('hex');
}

const enquiryAttemptLimiter = jsonRateLimit({
  ...RATE_LIMIT_POLICIES.enquiryAttempt,
  code: 'ENQUIRY_RATE_LIMITED',
  message: 'Too many enquiry attempts. Please wait before trying again.'
});

const enquiryEmailLimiter = jsonRateLimit({
  ...RATE_LIMIT_POLICIES.enquiryEmail,
  keyGenerator: normalizedEmailKey,
  code: 'ENQUIRY_EMAIL_LIMITED',
  message: 'This email address has reached the daily enquiry limit.'
});

const enquiryGlobalLimiter = jsonRateLimit({
  ...RATE_LIMIT_POLICIES.enquiryGlobal,
  keyGenerator: () => 'global',
  code: 'ENQUIRY_CAPACITY_REACHED',
  message: 'Enquiries are temporarily at capacity. Please try again later.'
});

const publicAssetLimiter = jsonRateLimit({
  ...RATE_LIMIT_POLICIES.publicAsset,
  code: 'ASSET_RATE_LIMITED'
});

const genericApiLimiter = jsonRateLimit({
  ...RATE_LIMIT_POLICIES.genericApi,
  code: 'API_RATE_LIMITED'
});

const dropboxOAuthLimiter = jsonRateLimit({
  ...RATE_LIMIT_POLICIES.dropboxOAuth,
  code: 'OAUTH_RATE_LIMITED'
});

const adminAttemptLimiter = jsonRateLimit({
  ...RATE_LIMIT_POLICIES.adminAttempt,
  code: 'ADMIN_RATE_LIMITED'
});

const manualOperationLimiter = jsonRateLimit({
  ...RATE_LIMIT_POLICIES.manualOperation,
  keyGenerator(req) {
    const token = (req.get('Authorization') || '').slice('Bearer '.length).trim();
    const secret = process.env.SESSION_SECRET || 'team-jd-unconfigured-session-secret';
    const adminKey = crypto.createHmac('sha256', secret).update(token).digest('hex');
    return `${clientKey(req)}:${adminKey}`;
  },
  skipFailedRequests: true,
  requestWasSuccessful: (_req, res) => res.statusCode < 400,
  code: 'MANUAL_OPERATION_RATE_LIMITED',
  message: 'Too many successful manual operations. Please wait before trying again.'
});

module.exports = {
  adminAttemptLimiter,
  clientKey,
  dropboxOAuthLimiter,
  enquiryAttemptLimiter,
  enquiryEmailLimiter,
  enquiryGlobalLimiter,
  genericApiLimiter,
  manualOperationLimiter,
  publicAssetLimiter,
  RATE_LIMIT_POLICIES
};
