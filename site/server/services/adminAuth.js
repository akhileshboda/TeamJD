const crypto = require('crypto');
const { createMailProvider, getMailConfig, MailProviderError } = require('./mail');
const { buildSignInCodeTemplate } = require('./enquiryTemplates');

// Dashboard sign-in: an allowlisted email address receives a one-time six-digit
// code. Codes live only in memory (one PM2 process), are stored as HMACs, expire
// after 10 minutes and die after 5 wrong guesses. A restart simply means asking
// for a new code.

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase().slice(0, 254) : '';
}

function getAllowedEmails(env = process.env) {
  return new Set(String(env.CMS_ADMIN_EMAILS || '').split(',').map(normalizeEmail).filter(Boolean));
}

// Local development only; staging and production both run NODE_ENV=production.
function isDevBypass(env = process.env) {
  return env.NODE_ENV !== 'production' && env.CMS_DEV_BYPASS === 'true';
}

function createCodeStore({ now = Date.now } = {}) {
  const codes = new Map();
  const secret = () => process.env.SESSION_SECRET || 'team-jd-unconfigured-session-secret';
  const digest = (email, code) => crypto.createHmac('sha256', secret()).update(`${email}:${code}`).digest();

  function sweep() {
    for (const [email, entry] of codes) {
      if (now() > entry.expiresAt) codes.delete(email);
    }
  }

  return {
    // A new code replaces any earlier one for the same address.
    issue(email) {
      sweep();
      const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
      codes.set(email, { digest: digest(email, code), expiresAt: now() + CODE_TTL_MS, attempts: 0 });
      return code;
    },

    // 'ok' | 'wrong' | 'expired' | 'missing'
    verify(email, code) {
      const entry = codes.get(email);
      if (!entry) return 'missing';
      if (now() > entry.expiresAt) {
        codes.delete(email);
        return 'expired';
      }
      entry.attempts += 1;
      const candidate = String(code ?? '').trim();
      if (/^\d{6}$/.test(candidate) && crypto.timingSafeEqual(entry.digest, digest(email, candidate))) {
        codes.delete(email);
        return 'ok';
      }
      if (entry.attempts >= MAX_ATTEMPTS) codes.delete(email);
      return 'wrong';
    }
  };
}

function isSignInMailConfigured(config = getMailConfig()) {
  return Boolean(config.provider === 'resend' && config.apiKey && config.from);
}

async function sendSignInCode(email, code, { config = getMailConfig(), provider } = {}) {
  if (!isSignInMailConfigured(config)) {
    throw new MailProviderError('Sign-in email is not configured.', { unavailable: true });
  }
  const template = buildSignInCodeTemplate({ code, baseUrl: config.baseUrl });
  const mailer = provider || createMailProvider(config);
  const subject = [config.subjectPrefix, 'Your Team JD sign-in code'].filter(Boolean).join(' ');
  return mailer.sendBatch(
    [{ from: config.from, to: [email], subject, html: template.html, text: template.text }],
    `admin-sign-in/${crypto.randomUUID()}`
  );
}

module.exports = {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  SESSION_MAX_AGE_MS,
  createCodeStore,
  getAllowedEmails,
  isDevBypass,
  isSignInMailConfigured,
  normalizeEmail,
  sendSignInCode
};
