const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const session = require('express-session');
const request = require('supertest');
const { findAccount, isGateEnabled, siteGate } = require('./siteGate');
const { createSiteAuthRouter } = require('../routes/siteAuth');

const ACCOUNTS = {
  SITE_AUTH_CLIENT_USER: 'jake',
  SITE_AUTH_CLIENT_PASS: 'client-pass',
  SITE_AUTH_ADMIN_USER: 'akhil',
  SITE_AUTH_ADMIN_PASS: 'admin-pass'
};

// Sets env vars for one test and puts the old values back afterwards.
async function withEnv(values, run) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function buildApp() {
  const app = express();
  app.use(session({ secret: 'site-gate-test', resave: false, saveUninitialized: false }));
  app.use((req, res, next) => {
    if (req.get('X-Test-Admin')) req.session.admin = { email: 'jake@team-jd.com.au' };
    next();
  });
  app.use(siteGate);
  app.use('/api/auth', createSiteAuthRouter());
  app.get('/results', (req, res) => res.send('<html>shell</html>'));
  app.get('/api/content/results', (req, res) => res.json([{ id: '1' }]));
  app.get('/api/admin/session', (req, res) => res.json({ signedIn: false }));
  return app;
}

test('the gate is on by default only on staging, and SITE_AUTH_ENABLED overrides it', () => {
  assert.equal(isGateEnabled({ NODE_ENV: 'production', APP_ENV: 'staging' }), true);
  assert.equal(isGateEnabled({ NODE_ENV: 'production' }), false);
  assert.equal(isGateEnabled({ NODE_ENV: 'development' }), false);
  assert.equal(isGateEnabled({ NODE_ENV: 'production', APP_ENV: 'staging', SITE_AUTH_ENABLED: 'false' }), false);
  assert.equal(isGateEnabled({ NODE_ENV: 'development', SITE_AUTH_ENABLED: 'true' }), true);
});

test('accounts come from the environment, and only a full match signs in', () => {
  assert.deepEqual(findAccount('jake', 'client-pass', ACCOUNTS), { role: 'client', username: 'jake' });
  assert.deepEqual(findAccount('akhil', 'admin-pass', ACCOUNTS), { role: 'admin', username: 'akhil' });
  assert.equal(findAccount('jake', 'admin-pass', ACCOUNTS), null);
  assert.equal(findAccount('', '', {}), null);
  assert.equal(findAccount(undefined, 'client-pass', ACCOUNTS), null);
});

test('while gated, pages load but the site data waits for sign-in; the dashboard stays reachable', async () => {
  await withEnv({ SITE_AUTH_ENABLED: 'true', ...ACCOUNTS }, async () => {
    const agent = request.agent(buildApp());
    const page = await agent.get('/results');
    assert.equal(page.status, 200);
    assert.equal(page.headers['x-robots-tag'], 'noindex, nofollow');
    assert.equal((await agent.get('/api/content/results')).status, 401);
    assert.equal((await agent.get('/api/admin/session')).status, 200);
    assert.deepEqual((await agent.get('/api/auth/status')).body, { enabled: true, authed: false });

    const wrong = await agent.post('/api/auth/login').set('Origin', 'http://127.0.0.1').set('Sec-Fetch-Site', 'same-origin')
      .send({ username: 'jake', password: 'nope' });
    assert.equal(wrong.status, 401);
    assert.equal((await agent.post('/api/auth/login').set('Sec-Fetch-Site', 'cross-site')
      .send({ username: 'jake', password: 'client-pass' })).status, 403);

    const signedIn = await agent.post('/api/auth/login').set('Sec-Fetch-Site', 'same-origin')
      .send({ username: 'jake', password: 'client-pass' });
    assert.equal(signedIn.status, 200);
    assert.equal((await agent.get('/api/content/results')).status, 200);
    assert.deepEqual((await agent.get('/api/auth/status')).body, { enabled: true, authed: true });
  });
});

test('a signed-in dashboard admin gets through the gate without its password', async () => {
  await withEnv({ SITE_AUTH_ENABLED: 'true', CMS_ADMIN_EMAILS: 'jake@team-jd.com.au' }, async () => {
    const response = await request(buildApp()).get('/api/content/results').set('X-Test-Admin', '1');
    assert.equal(response.status, 200);
  });
});

test('with the gate off, nothing is gated or marked noindex', async () => {
  await withEnv({ SITE_AUTH_ENABLED: 'false' }, async () => {
    const response = await request(buildApp()).get('/api/content/results');
    assert.equal(response.status, 200);
    assert.equal(response.headers['x-robots-tag'], undefined);
  });
});
