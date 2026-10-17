const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const session = require('express-session');
const request = require('supertest');
const { createAdminAuthRouter } = require('./adminAuth');
const { requireAdmin } = require('../middleware/adminAuth');
const { createCodeStore, MAX_ATTEMPTS, MAX_TOTAL_ATTEMPTS, SESSION_MAX_AGE_MS } = require('../services/adminAuth');

const env = { NODE_ENV: 'production', CMS_ADMIN_EMAILS: 'Jake@Team-JD.com.au, akhil@example.com' };
let ipCounter = 10;

function buildApp({ now, appEnv = env } = {}) {
  const sent = [];
  const codes = createCodeStore({ now });
  const app = express();
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
  app.use('/api/admin/auth', createAdminAuthRouter({
    env: appEnv,
    codes,
    sendCode: async (email, code) => sent.push({ email, code })
  }));
  app.get('/api/admin/me', requireAdmin({ env: appEnv }), (req, res) => res.json({ email: req.admin.email }));
  // Each test gets its own client IP so the shared rate limiters stay out of the way.
  const ip = `203.0.113.${ipCounter += 1}`;
  const agent = request.agent(app);
  const postFrom = (from, url, body) => agent.post(url).set('Sec-Fetch-Site', 'same-origin').set('CF-Connecting-IP', from).send(body);
  const post = (url, body) => postFrom(ip, url, body);
  const otherIp = () => `198.51.100.${ipCounter += 1}`;
  return { agent, post, postFrom, otherIp, sent };
}

test('an allowlisted email gets a code and signs in for 30 days', async () => {
  const { agent, post, sent } = buildApp();
  assert.equal((await agent.get('/api/admin/me')).status, 401);

  const requested = await post('/api/admin/auth/code', { email: ' jake@team-jd.com.au ' });
  assert.equal(requested.status, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].email, 'jake@team-jd.com.au');
  assert.match(sent[0].code, /^\d{6}$/);

  const verified = await post('/api/admin/auth/verify', { email: 'jake@team-jd.com.au', code: sent[0].code });
  assert.equal(verified.status, 200);
  const expires = /Expires=([^;]+)/.exec(verified.headers['set-cookie'].join(';'))[1];
  assert.ok(Math.abs(new Date(expires) - Date.now() - SESSION_MAX_AGE_MS) < 60 * 1000);

  assert.deepEqual((await agent.get('/api/admin/me')).body, { email: 'jake@team-jd.com.au' });
  assert.deepEqual((await agent.get('/api/admin/auth/session')).body, { signedIn: true, email: 'jake@team-jd.com.au' });

  assert.equal((await post('/api/admin/auth/logout')).status, 204);
  assert.equal((await agent.get('/api/admin/me')).status, 401);
});

test('unknown emails get the same answer but no email', async () => {
  const { post, sent } = buildApp();
  const response = await post('/api/admin/auth/code', { email: 'stranger@example.com' });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true });
  assert.equal(sent.length, 0);
  assert.equal((await post('/api/admin/auth/code', { email: 'not-an-email' })).status, 400);
});

test('a code works once, locks a device after too many wrong guesses, and expires', async () => {
  let clock = Date.now();
  const { post, sent } = buildApp({ now: () => clock });
  await post('/api/admin/auth/code', { email: 'akhil@example.com' });
  const { code } = sent[0];
  const wrong = code === '000000' ? '111111' : '000000';

  for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
    assert.equal((await post('/api/admin/auth/verify', { email: 'akhil@example.com', code: wrong })).status, 401);
  }
  assert.equal((await post('/api/admin/auth/verify', { email: 'akhil@example.com', code: wrong })).status, 401);
  // After five wrong guesses this device cannot try again, even with the right code.
  const locked = await post('/api/admin/auth/verify', { email: 'akhil@example.com', code });
  assert.equal(locked.status, 401);
  assert.match(locked.body.error, /Too many wrong codes/);

  await post('/api/admin/auth/code', { email: 'akhil@example.com' });
  clock += 11 * 60 * 1000;
  const expired = await post('/api/admin/auth/verify', { email: 'akhil@example.com', code: sent[1].code });
  assert.equal(expired.status, 401);
  assert.match(expired.body.error, /expired/);
});

test('cross-site sign-in attempts are refused', async () => {
  const { agent } = buildApp();
  const response = await agent.post('/api/admin/auth/code')
    .set('Sec-Fetch-Site', 'cross-site')
    .send({ email: 'jake@team-jd.com.au' });
  assert.equal(response.status, 403);
  assert.equal((await agent.post('/api/admin/auth/code').send({ email: 'jake@team-jd.com.au' })).status, 403);
});

test('requesting codes is rate limited per email address', async () => {
  const { post } = buildApp();
  const statuses = [];
  for (let index = 0; index < 6; index += 1) {
    statuses.push((await post('/api/admin/auth/code', { email: 'someone-else@example.com' })).status);
  }
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
});

test('a stranger cannot lock Jake out by guessing or asking for codes', async () => {
  const { post, postFrom, otherIp, sent } = buildApp();
  const email = 'jake@team-jd.com.au';
  await post('/api/admin/auth/code', { email });
  const jakesCode = sent[0].code;
  const wrong = jakesCode === '000000' ? '111111' : '000000';

  const stranger = otherIp();
  await postFrom(stranger, '/api/admin/auth/code', { email });
  for (let attempt = 0; attempt < MAX_ATTEMPTS + 1; attempt += 1) {
    assert.equal((await postFrom(stranger, '/api/admin/auth/verify', { email, code: wrong })).status, 401);
  }

  // The stranger's new code did not cancel Jake's, and their guesses only locked them out.
  assert.equal(sent.length, 2);
  assert.equal((await post('/api/admin/auth/verify', { email, code: jakesCode })).status, 200);
});

test('guessing from many devices still kills every code for that address', () => {
  const codes = createCodeStore();
  const code = codes.issue('jake@team-jd.com.au');
  const wrong = code === '000000' ? '111111' : '000000';
  for (let attempt = 0; attempt < MAX_TOTAL_ATTEMPTS; attempt += 1) {
    codes.verify('jake@team-jd.com.au', wrong, `client-${attempt}`);
  }
  assert.equal(codes.verify('jake@team-jd.com.au', code, 'jake'), 'missing');
});

test('taking an address off the allowlist ends its sessions', async () => {
  const appEnv = { ...env };
  const { agent, post, sent } = buildApp({ appEnv });
  await post('/api/admin/auth/code', { email: 'akhil@example.com' });
  await post('/api/admin/auth/verify', { email: 'akhil@example.com', code: sent[0].code });
  assert.equal((await agent.get('/api/admin/me')).status, 200);

  appEnv.CMS_ADMIN_EMAILS = 'jake@team-jd.com.au';
  assert.equal((await agent.get('/api/admin/me')).status, 401);
});
