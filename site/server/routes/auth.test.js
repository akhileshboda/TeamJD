const assert = require('node:assert/strict');
const test = require('node:test');
const { requireDropboxOAuthWindow } = require('./auth');

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
