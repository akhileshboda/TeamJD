const assert = require('node:assert/strict');
const test = require('node:test');
const { TURNSTILE_ACTION, verifyTurnstile } = require('./turnstile');

function withSecret(run) {
  const previous = process.env.TURNSTILE_SECRET_KEY;
  const previousBaseUrl = process.env.PUBLIC_BASE_URL;
  process.env.TURNSTILE_SECRET_KEY = 'turnstile-secret';
  process.env.PUBLIC_BASE_URL = 'https://team-jd.com.au';
  return Promise.resolve(run()).finally(() => {
    if (previous === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = previous;
    if (previousBaseUrl === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previousBaseUrl;
  });
}

test('Turnstile verification sends the token and client IP server-side without weakening replay protection', async () => withSecret(async () => {
  let body;
  const result = await verifyTurnstile({
    token: 'single-use-token',
    remoteIp: '203.0.113.10',
    fetchImpl: async (_url, options) => {
      body = new URLSearchParams(options.body);
      return { ok: true, json: async () => ({ success: true, action: TURNSTILE_ACTION, hostname: 'team-jd.com.au' }) };
    }
  });

  assert.deepEqual(result, { ok: true, unavailable: false });
  assert.equal(body.get('secret'), 'turnstile-secret');
  assert.equal(body.get('response'), 'single-use-token');
  assert.equal(body.get('remoteip'), '203.0.113.10');
  assert.equal(body.has('idempotency_key'), false);
}));

test('Turnstile replay/expiry and action mismatch fail verification', async () => withSecret(async () => {
  const replayed = await verifyTurnstile({
    token: 'replayed',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ success: false, 'error-codes': ['timeout-or-duplicate'] })
    })
  });
  assert.deepEqual(replayed, { ok: false, unavailable: false });

  const wrongAction = await verifyTurnstile({
    token: 'valid-token-wrong-action',
    fetchImpl: async () => ({ ok: true, json: async () => ({ success: true, action: 'other', hostname: 'team-jd.com.au' }) })
  });
  assert.deepEqual(wrongAction, { ok: false, unavailable: false });

  const wrongHostname = await verifyTurnstile({
    token: 'valid-token-wrong-hostname',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ success: true, action: TURNSTILE_ACTION, hostname: 'attacker.example' })
    })
  });
  assert.deepEqual(wrongHostname, { ok: false, unavailable: false });
}));

test('Turnstile network/configuration failures are distinguished as unavailable', async () => {
  const previous = process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  assert.deepEqual(await verifyTurnstile({ token: 'token' }), {
    ok: false,
    unavailable: true
  });
  if (previous !== undefined) process.env.TURNSTILE_SECRET_KEY = previous;
});
