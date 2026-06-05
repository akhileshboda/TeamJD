const express = require('express');
const { isGateEnabled, findAccount } = require('../middleware/siteGate');
const { logVisit } = require('../services/visitLog');

const router = express.Router();

// Lets the client decide whether to show the overlay without ever exposing
// credentials. Always reachable (not behind the gate).
router.get('/status', (req, res) => {
  return res.json({
    enabled: isGateEnabled(),
    authed: Boolean(req.session?.siteAuth?.authed),
    role: req.session?.siteAuth?.role || null
  });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const account = findAccount(username, password);

  if (!account) {
    logVisit({
      type: 'login',
      success: false,
      username: typeof username === 'string' ? username : null,
      ip: req.ip,
      ua: req.get('user-agent') || null
    });
    return res.status(401).json({ error: 'Incorrect username or password' });
  }

  req.session.siteAuth = {
    authed: true,
    role: account.role,
    username: account.username
  };

  req.session.save((saveError) => {
    if (saveError) {
      return res.status(500).json({ error: 'Failed to sign in' });
    }

    logVisit({
      type: 'login',
      success: true,
      username: account.username,
      role: account.role,
      ip: req.ip,
      ua: req.get('user-agent') || null
    });

    return res.json({ ok: true, role: account.role });
  });
});

router.post('/logout', (req, res) => {
  if (!req.session) {
    return res.json({ ok: true });
  }

  req.session.destroy((destroyError) => {
    if (destroyError) {
      return res.status(500).json({ error: 'Failed to sign out' });
    }

    res.clearCookie('teamjd.sid');
    return res.json({ ok: true });
  });
});

module.exports = router;
