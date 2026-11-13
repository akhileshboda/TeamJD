const express = require('express');
const { getClientIp } = require('../middleware/clientIp');
const { adminAttemptLimiter, adminCodeEmailLimiter, adminCodeEmailTotalLimiter } = require('../middleware/rateLimits');
const { getAdmin, requireSameOrigin } = require('../middleware/adminAuth');
const auth = require('../services/adminAuth');

const SIGN_IN_FAILED_MESSAGE = 'That code did not work. It may be wrong or expired. Use the code in the latest email, or wait a few minutes and ask for a new one.';

// /api/admin/auth — the dashboard's email-code sign-in. Responses never reveal
// whether an address is on the allowlist, by content or by timing: the email is
// sent after the response, so failures are logged rather than reported.

function createAdminAuthRouter(options = {}) {
  const router = express.Router();
  const env = options.env || process.env;
  const codes = options.codes || auth.createCodeStore();
  const sendCode = options.sendCode || auth.sendSignInCode;
  const parseJson = express.json({ limit: '4kb', strict: true });

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(requireSameOrigin);

  router.get('/session', (req, res) => {
    const admin = getAdmin(req, env);
    return res.json({ signedIn: Boolean(admin), email: admin?.email || null });
  });

  router.post('/code', adminAttemptLimiter, parseJson, adminCodeEmailLimiter, adminCodeEmailTotalLimiter, (req, res) => {
    const email = auth.normalizeEmail(req.body?.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (!options.sendCode && !auth.isSignInMailConfigured()) {
      return res.status(503).json({ error: 'Sign-in email is not set up on this server yet.' });
    }

    if (auth.getAllowedEmails(env).has(email)) {
      Promise.resolve()
        .then(() => sendCode(email, codes.issue(email)))
        .catch((error) => console.error('[admin-auth] sign-in code email failed:', error.message));
    }
    return res.json({ ok: true });
  });

  router.post('/verify', adminAttemptLimiter, parseJson, (req, res, next) => {
    const email = auth.normalizeEmail(req.body?.email);
    const result = email ? codes.verify(email, req.body?.code, getClientIp(req)) : 'missing';
    if (result !== 'ok') {
      // One message for every failure: 'expired' and 'locked' only happen for
      // allowlisted addresses, so distinct wording would reveal who is an admin.
      if (result === 'locked') console.warn(`[admin-auth] sign-in locked for ${email} from ${getClientIp(req)}`);
      return res.status(401).json({ error: SIGN_IN_FAILED_MESSAGE });
    }

    // A fresh session id on sign-in prevents session fixation.
    return req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.admin = { email, signedInAt: new Date().toISOString() };
      req.session.cookie.maxAge = auth.SESSION_MAX_AGE_MS;
      console.log(`[admin-auth] signed in ${email} from ${getClientIp(req)}`);
      return req.session.save((saveError) => (saveError ? next(saveError) : res.json({ email })));
    });
  });

  router.post('/logout', (req, res, next) => {
    if (!req.session) return res.status(204).end();
    return req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie('teamjd.sid');
      return res.status(204).end();
    });
  });

  return router;
}

module.exports = { createAdminAuthRouter };
