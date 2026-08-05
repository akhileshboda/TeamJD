const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const express = require('express');
const request = require('supertest');
const { enquiryEmailLimiter, enquiryGlobalLimiter } = require('../middleware/rateLimits');
const { MailProviderError } = require('../services/mail');
const { createEnquiriesRouter } = require('./enquiries');

function payload(overrides = {}) {
  return {
    firstName: 'Akhil',
    lastName: 'Boda',
    email: 'customer@example.com',
    service: 'online-coaching',
    message: 'I would like to learn more.',
    submissionId: crypto.randomUUID(),
    website: '',
    turnstileToken: 'single-use-token',
    ...overrides
  };
}

function appWith(dependencies) {
  const app = express();
  app.use('/api/enquiries', createEnquiriesRouter(dependencies));
  return app;
}

function post(app, body, ip = '203.0.113.1') {
  return request(app).post('/api/enquiries').set('CF-Connecting-IP', ip).send(body);
}

test('honeypot submissions return generic 202 without security or provider calls', async () => {
  const verifyTurnstile = test.mock.fn();
  const deliverEnquiry = test.mock.fn();
  const app = appWith({ verifyTurnstile, deliverEnquiry });

  const response = await post(app, { website: 'https://spam.example' }, '203.0.113.2');
  assert.equal(response.status, 202);
  assert.deepEqual(response.body, { ok: true, message: 'Your enquiry has been received.' });
  assert.equal(verifyTurnstile.mock.callCount(), 0);
  assert.equal(deliverEnquiry.mock.callCount(), 0);
});

test('public configuration exposes only availability and the Turnstile site key', async () => {
  const keys = [
    'ENQUIRY_MAIL_PROVIDER', 'RESEND_API_KEY', 'ENQUIRY_EMAIL_FROM',
    'ENQUIRY_NOTIFICATION_TO', 'ENQUIRY_REPLY_TO', 'TURNSTILE_SITE_KEY',
    'TURNSTILE_SECRET_KEY'
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    ENQUIRY_MAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 'secret-resend-key',
    ENQUIRY_EMAIL_FROM: 'Team JD <enquiries@send.team-jd.com.au>',
    ENQUIRY_NOTIFICATION_TO: 'akhileshboda@outlook.com',
    ENQUIRY_REPLY_TO: 'akhileshboda@outlook.com',
    TURNSTILE_SITE_KEY: 'public-site-key',
    TURNSTILE_SECRET_KEY: 'secret-turnstile-key'
  });

  try {
    const response = await request(appWith({})).get('/api/enquiries/config').set('CF-Connecting-IP', '203.0.113.9');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { available: true, turnstileSiteKey: 'public-site-key' });
    assert.doesNotMatch(JSON.stringify(response.body), /secret|outlook|resend-key/i);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('validation and Turnstile failures stop before mail delivery', async () => {
  const deliverEnquiry = test.mock.fn();
  const invalidApp = appWith({ verifyTurnstile: test.mock.fn(), deliverEnquiry });
  const invalid = await post(invalidApp, payload({ email: 'not-an-email' }), '203.0.113.3');
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, 'INVALID_ENQUIRY');

  const failedApp = appWith({ verifyTurnstile: async () => ({ ok: false, unavailable: false }), deliverEnquiry });
  const failed = await post(failedApp, payload(), '203.0.113.4');
  assert.equal(failed.status, 403);
  assert.equal(failed.body.error.code, 'SECURITY_CHECK_FAILED');

  const unavailableApp = appWith({ verifyTurnstile: async () => ({ ok: false, unavailable: true }), deliverEnquiry });
  const unavailable = await post(unavailableApp, payload(), '203.0.113.5');
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.body.error.code, 'SECURITY_CHECK_UNAVAILABLE');
  assert.equal(deliverEnquiry.mock.callCount(), 0);
});

test('returns 202 only after the idempotent provider batch is accepted', async () => {
  const deliverEnquiry = test.mock.fn(async () => ({ accepted: true }));
  const app = appWith({ verifyTurnstile: async () => ({ ok: true, unavailable: false }), deliverEnquiry });
  const body = payload({ email: 'accepted@example.com' });
  const response = await post(app, body, '203.0.113.6');

  assert.equal(response.status, 202);
  assert.equal(deliverEnquiry.mock.callCount(), 1);
  assert.equal(deliverEnquiry.mock.calls[0].arguments[0].email, 'accepted@example.com');
});

test('maps provider rejection and outage to provider-neutral 502/503 errors', async () => {
  const verify = async () => ({ ok: true, unavailable: false });
  const rejected = appWith({
    verifyTurnstile: verify,
    deliverEnquiry: async () => { throw new MailProviderError('provider detail'); }
  });
  const unavailable = appWith({
    verifyTurnstile: verify,
    deliverEnquiry: async () => { throw new MailProviderError('provider detail', { unavailable: true }); }
  });

  const badGateway = await post(rejected, payload({ email: 'reject@example.com' }), '203.0.113.7');
  assert.equal(badGateway.status, 502);
  assert.doesNotMatch(JSON.stringify(badGateway.body), /provider detail|resend/i);

  const serviceUnavailable = await post(unavailable, payload({ email: 'outage@example.com' }), '203.0.113.8');
  assert.equal(serviceUnavailable.status, 503);
  assert.doesNotMatch(JSON.stringify(serviceUnavailable.body), /provider detail|resend/i);
});

test('enforces five enquiry attempts per client IP with standard headers', async () => {
  const app = appWith({
    verifyTurnstile: async () => ({ ok: false, unavailable: false }),
    deliverEnquiry: test.mock.fn()
  });
  const ip = '203.0.113.20';

  for (let index = 0; index < 5; index += 1) {
    assert.equal((await post(app, payload({ email: `attempt-${index}@example.com` }), ip)).status, 403);
  }
  const limited = await post(app, payload({ email: 'attempt-six@example.com' }), ip);
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error.code, 'ENQUIRY_RATE_LIMITED');
  assert.ok(limited.headers.ratelimit);
  assert.ok(limited.headers['retry-after']);
});

test('enforces accepted-enquiry limits per normalized email and globally', async () => {
  process.env.SESSION_SECRET ||= 'enquiry-route-test-secret';
  enquiryGlobalLimiter.resetKey('global');
  const deliver = async () => ({ accepted: true });
  const app = appWith({ verifyTurnstile: async () => ({ ok: true, unavailable: false }), deliverEnquiry: deliver });
  const email = 'same@example.com';

  for (let index = 0; index < 3; index += 1) {
    assert.equal((await post(app, payload({ email }), `203.0.113.${30 + index}`)).status, 202);
  }
  const emailLimited = await post(app, payload({ email: 'SAME@example.com' }), '203.0.113.40');
  assert.equal(emailLimited.status, 429);
  assert.equal(emailLimited.body.error.code, 'ENQUIRY_EMAIL_LIMITED');

  const emailKey = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(email).digest('hex');
  enquiryEmailLimiter.resetKey(emailKey);
  enquiryGlobalLimiter.resetKey('global');

  for (let index = 0; index < 40; index += 1) {
    const octet3 = 100 + Math.floor(index / 200);
    const octet4 = 1 + (index % 200);
    const response = await post(
      app,
      payload({ email: `global-${index}@example.com` }),
      `198.51.${octet3}.${octet4}`
    );
    assert.equal(response.status, 202);
  }
  const globalLimited = await post(app, payload({ email: 'global-limit@example.com' }), '192.0.2.200');
  assert.equal(globalLimited.status, 429);
  assert.equal(globalLimited.body.error.code, 'ENQUIRY_CAPACITY_REACHED');
  enquiryGlobalLimiter.resetKey('global');
});
