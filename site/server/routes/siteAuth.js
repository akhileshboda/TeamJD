const express = require('express');
const { requireSameOrigin } = require('../middleware/adminAuth');
const { findAccount, isGateEnabled, isSignedIn } = require('../middleware/siteGate');
const { siteLoginLimiter } = require('../middleware/rateLimits');

// /api/auth — the staging gate's sign-in. Always reachable, even while gated.
function createSiteAuthRouter() {
  const router = express.Router();
  const parseJson = express.json({ limit: '4kb', strict: true });

  // Lets the browser decide whether to show the sign-in screen, without ever
  // exposing the accounts.
  router.get('/status', (req, res) => {
    res.set('Cache-Control', 'no-store');
    return res.json({ enabled: isGateEnabled(), authed: isSignedIn(req) });
  });

  // Same-origin only, like the dashboard's sign-in, so another site cannot sign
  // a visitor in to its own account.
  router.post('/login', requireSameOrigin, siteLoginLimiter, parseJson, (req, res, next) => {
    const { username, password } = req.body || {};
    const account = findAccount(username, password);
    if (!account) return res.status(401).json({ error: 'Incorrect username or password.' });

    // A fresh session id on sign-in, so one set before it cannot be reused.
    return req.session.regenerate((regenerateError) => {
      if (regenerateError) return next(regenerateError);
      req.session.siteAuth = { authed: true, role: account.role };
      return req.session.save((saveError) => (saveError ? next(saveError) : res.json({ ok: true })));
    });
  });

  return router;
}

module.exports = { createSiteAuthRouter };
