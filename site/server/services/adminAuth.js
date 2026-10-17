const crypto = require('crypto');
const { createMailProvider, getMailConfig, MailProviderError } = require('./mail');
const { buildSignInCodeTemplate } = require('./enquiryTemplates');

// Dashboard sign-in: an allowlisted email address receives a one-time six-digit
// code. Codes live only in memory (one PM2 process), are stored as HMACs and
// expire after 10 minutes. A restart simply means asking for a new code.
//
// Jake's address is public, so nobody else should be able to lock him out:
//   - asking for a new code never cancels earlier ones still within their time;
//   - wrong guesses are counted per address *and* client, so a stranger's
//     guesses never block Jake's own device;
//   - a higher cap across all clients still stops guessing from many machines,
//     at which point every code for that address dies and a new one is needed.

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_TOTAL_ATTEMPTS = 25;
const MAX_LIVE_CODES = 5;
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
  // email → { codes: [{ digest, expiresAt }], wrongByClient: Map, wrongTotal }
  const entries = new Map();
  const secret = () => process.env.SESSION_SECRET || 'team-jd-unconfigured-session-secret';
  const digest = (email, code) => crypto.createHmac('sha256', secret()).update(`${email}:${code}`).digest();

  // Drops expired codes, and an address's whole entry (with its wrong-guess
  // counts) once none of its codes are left.
  function liveEntry(email) {
    const entry = entries.get(email);
    if (!entry) return null;
    entry.codes = entry.codes.filter((code) => now() <= code.expiresAt);
    if (entry.codes.length) return entry;
    entries.delete(email);
    return null;
  }

  return {
    issue(email) {
      for (const known of entries.keys()) liveEntry(known);
      const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
      const entry = entries.get(email) || { codes: [], wrongByClient: new Map(), wrongTotal: 0 };
      entry.codes = [...entry.codes, { digest: digest(email, code), expiresAt: now() + CODE_TTL_MS }].slice(-MAX_LIVE_CODES);
      entries.set(email, entry);
      return code;
    },

    // 'ok' | 'wrong' | 'locked' | 'expired' | 'missing'
    verify(email, code, client = 'unknown') {
      const known = entries.has(email);
      const entry = liveEntry(email);
      if (!entry) return known ? 'expired' : 'missing';
      if ((entry.wrongByClient.get(client) || 0) >= MAX_ATTEMPTS) return 'locked';

      const candidate = String(code ?? '').trim();
      const valid = /^\d{6}$/.test(candidate)
        && entry.codes.some((stored) => crypto.timingSafeEqual(stored.digest, digest(email, candidate)));
      if (valid) {
        entries.delete(email);
        return 'ok';
      }
      entry.wrongByClient.set(client, (entry.wrongByClient.get(client) || 0) + 1);
      entry.wrongTotal += 1;
      if (entry.wrongTotal >= MAX_TOTAL_ATTEMPTS) entries.delete(email);
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
  MAX_TOTAL_ATTEMPTS,
  SESSION_MAX_AGE_MS,
  createCodeStore,
  getAllowedEmails,
  isDevBypass,
  isSignInMailConfigured,
  normalizeEmail,
  sendSignInCode
};
