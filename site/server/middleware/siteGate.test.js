const assert = require('node:assert/strict');
const test = require('node:test');
const { gateAssets } = require('./siteGate');

function withGateEnabled(run) {
  const original = process.env.SITE_AUTH_ENABLED;
  process.env.SITE_AUTH_ENABLED = 'true';

  try {
    run();
  } finally {
    if (original === undefined) {
      delete process.env.SITE_AUTH_ENABLED;
    } else {
      process.env.SITE_AUTH_ENABLED = original;
    }
  }
}

function runGate({ path, method = 'GET', authorization = '', authed = false }) {
  const req = {
    method,
    path,
    session: authed ? { siteAuth: { authed: true } } : {},
    get(name) {
      return name.toLowerCase() === 'authorization' ? authorization : '';
    }
  };
  const res = {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
  let nextCalled = false;

  gateAssets(req, res, () => {
    nextCalled = true;
  });

  return { nextCalled, statusCode: res.statusCode, payload: res.payload };
}

test('allows public asset manifest and asset redirect routes through the site gate', () => {
  withGateEnabled(() => {
    assert.equal(runGate({ path: '/' }).nextCalled, true);
    assert.equal(runGate({ path: '/manifest' }).nextCalled, true);
    assert.equal(runGate({ path: '/hero-bg' }).nextCalled, true);
    assert.equal(runGate({ path: '/logo-mark' }).nextCalled, true);
  });
});

test('allows protected asset admin routes through only when bearer auth is present', () => {
  withGateEnabled(() => {
    assert.equal(runGate({ path: '/sync/plan' }).statusCode, 401);
    assert.equal(
      runGate({ path: '/sync/plan', authorization: 'Bearer token' }).nextCalled,
      true
    );
    assert.equal(
      runGate({ path: '/setup-status', authorization: 'Bearer token' }).nextCalled,
      true
    );
    assert.equal(runGate({ path: '/discover' }).statusCode, 401);
  });
});
