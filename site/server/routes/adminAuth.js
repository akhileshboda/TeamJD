const express = require('express');
const { adminAttemptLimiter, adminCodeEmailLimiter } = require('../middleware/rateLimits');
const { getAdmin, requireSameOrigin } = require('../middleware/adminAuth');
const auth = require('../services/adminAuth');

// /api/admin/auth — the dashboard's email-code sign-in. Responses never reveal
// whether an address is on the allowlist.

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

  router.post('/code', adminAttemptLimiter, parseJson, adminCodeEmailLimiter, async (req, res) => {
    const email = auth.normalizeEmail(req.body?.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (!options.sendCode && !auth.isSignInMailConfigured()) {
      return res.status(503).json({ error: 'Sign-in email is not set up on this server yet.' });
    }

    if (auth.getAllowedEmails(env).has(email)) {
      try {
        await sendCode(email, codes.issue(email));
      } catch (error) {
        console.error('[admin-auth] sign-in code email failed:', error.message);
        return res.status(502).json({ error: 'We could not send the email just now. Try again in a minute.' });
      }
    }
    return res.json({ ok: true });
  });

  router.post('/verify', adminAttemptLimiter, parseJson, (req, res, next) => {
    const email = auth.normalizeEmail(req.body?.email);
    const result = email ? codes.verify(email, req.body?.code) : 'missing';
    if (result !== 'ok') {
      const message = result === 'expired'
        ? 'That code has expired. Ask for a new one.'
        : 'That code is not right. Check the latest email, or ask for a new code.';
      return res.status(401).json({ error: message });
    }

    // A fresh session id on sign-in prevents session fixation.
    return req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.admin = { email, signedInAt: new Date().toISOString() };
      req.session.cookie.maxAge = auth.SESSION_MAX_AGE_MS;
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
