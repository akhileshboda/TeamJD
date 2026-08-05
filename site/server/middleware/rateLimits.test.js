const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const request = require('supertest');
const {
  adminAttemptLimiter,
  dropboxOAuthLimiter,
  genericApiLimiter,
  manualOperationLimiter,
  publicAssetLimiter,
  RATE_LIMIT_POLICIES
} = require('./rateLimits');

test('declares every route-family budget in milliseconds and request counts', () => {
  assert.deepEqual(RATE_LIMIT_POLICIES, {
    enquiryAttempt: { windowMs: 15 * 60 * 1000, limit: 5 },
    enquiryEmail: { windowMs: 24 * 60 * 60 * 1000, limit: 3 },
    enquiryGlobal: { windowMs: 24 * 60 * 60 * 1000, limit: 40 },
    publicAsset: { windowMs: 5 * 60 * 1000, limit: 300 },
    genericApi: { windowMs: 5 * 60 * 1000, limit: 120 },
    dropboxOAuth: { windowMs: 15 * 60 * 1000, limit: 10 },
    adminAttempt: { windowMs: 15 * 60 * 1000, limit: 10 },
    manualOperation: { windowMs: 15 * 60 * 1000, limit: 3 }
  });
});

test('successful manual operations are capped with standard RateLimit and Retry-After headers', async () => {
  process.env.SESSION_SECRET ||= 'rate-limit-test-secret';
  const app = express();
  app.post('/manual', manualOperationLimiter, (_req, res) => res.json({ ok: true }));
  const headers = { Authorization: 'Bearer admin-rate-limit-test', 'CF-Connecting-IP': '203.0.113.99' };

  for (let index = 0; index < 3; index += 1) {
    const response = await request(app).post('/manual').set(headers);
    assert.equal(response.status, 200);
    assert.ok(response.headers.ratelimit);
  }

  const limited = await request(app).post('/manual').set(headers);
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error.code, 'MANUAL_OPERATION_RATE_LIMITED');
  assert.ok(limited.headers.ratelimit);
  assert.ok(limited.headers['retry-after']);
});

async function assertFamilyBoundary({ middleware, limit, code, ip }) {
  const app = express();
  app.get('/limited', middleware, (_req, res) => res.json({ ok: true }));

  for (let index = 0; index < limit; index += 1) {
    const response = await request(app).get('/limited').set('CF-Connecting-IP', ip);
    assert.equal(response.status, 200);
  }

  const limited = await request(app).get('/limited').set('CF-Connecting-IP', ip);
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error.code, code);
  assert.ok(limited.headers.ratelimit);
  assert.ok(limited.headers['retry-after']);
}

test('public assets, generic API, OAuth, and admin attempts enforce independent boundaries', async () => {
  await assertFamilyBoundary({
    middleware: publicAssetLimiter,
    limit: 300,
    code: 'ASSET_RATE_LIMITED',
    ip: '203.0.113.101'
  });
  await assertFamilyBoundary({
    middleware: genericApiLimiter,
    limit: 120,
    code: 'API_RATE_LIMITED',
    ip: '203.0.113.102'
  });
  await assertFamilyBoundary({
    middleware: dropboxOAuthLimiter,
    limit: 10,
    code: 'OAUTH_RATE_LIMITED',
    ip: '203.0.113.103'
  });
  await assertFamilyBoundary({
    middleware: adminAttemptLimiter,
    limit: 10,
    code: 'ADMIN_RATE_LIMITED',
    ip: '203.0.113.104'
  });
});

test('failed manual operations do not consume the successful-operation budget', async () => {
  process.env.SESSION_SECRET ||= 'rate-limit-test-secret';
  const app = express();
  app.post('/manual', manualOperationLimiter, (req, res) => {
    return res.status(req.query.fail === 'true' ? 500 : 200).json({ ok: req.query.fail !== 'true' });
  });
  const headers = { Authorization: 'Bearer distinct-admin-test', 'CF-Connecting-IP': '203.0.113.105' };

  for (let index = 0; index < 4; index += 1) {
    assert.equal((await request(app).post('/manual?fail=true').set(headers)).status, 500);
  }
  for (let index = 0; index < 3; index += 1) {
    assert.equal((await request(app).post('/manual').set(headers)).status, 200);
  }
  assert.equal((await request(app).post('/manual').set(headers)).status, 429);
});
