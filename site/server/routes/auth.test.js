const assert = require('node:assert/strict');
const test = require('node:test');
const { requireDropboxOAuthWindow, requireAdminInProduction } = require('./auth');

function runGuard(environment, enabled) {
  const previousEnvironment = process.env.NODE_ENV;
  const previousEnabled = process.env.DROPBOX_OAUTH_ENABLED;
  process.env.NODE_ENV = environment;
  if (enabled === undefined) delete process.env.DROPBOX_OAUTH_ENABLED;
  else process.env.DROPBOX_OAUTH_ENABLED = enabled;

  const result = { next: false, status: null, payload: null };
  const res = {
    status(code) { result.status = code; return this; },
    json(payload) { result.payload = payload; return this; }
  };
  requireDropboxOAuthWindow({}, res, () => { result.next = true; });

  if (previousEnvironment === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousEnvironment;
  if (previousEnabled === undefined) delete process.env.DROPBOX_OAUTH_ENABLED;
  else process.env.DROPBOX_OAUTH_ENABLED = previousEnabled;
  return result;
}

test('Dropbox OAuth is disabled by default in production-mode environments', () => {
  assert.deepEqual(runGuard('production'), {
    next: false,
    status: 404,
    payload: { error: 'Not found.' }
  });
});

test('Dropbox OAuth requires an explicit controlled production window', () => {
  assert.equal(runGuard('production', 'true').next, true);
  assert.equal(runGuard('development').next, true);
});

test('Dropbox OAuth in production needs a signed-in dashboard admin', () => {
  const previous = { NODE_ENV: process.env.NODE_ENV, CMS_ADMIN_EMAILS: process.env.CMS_ADMIN_EMAILS };
  process.env.NODE_ENV = 'production';
  process.env.CMS_ADMIN_EMAILS = 'owner@example.com';
  try {
    const run = (session) => {
      const result = { next: false, status: null };
      const res = {
        set() { return this; },
        status(code) { result.status = code; return this; },
        json() { return this; }
      };
      requireAdminInProduction({ session }, res, () => { result.next = true; });
      return result;
    };
    assert.deepEqual(run({}), { next: false, status: 401 });
    assert.deepEqual(run({ admin: { email: 'owner@example.com' } }), { next: true, status: null });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
