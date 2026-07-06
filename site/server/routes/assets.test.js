const assert = require('node:assert/strict');
const test = require('node:test');
const { requireSyncAdmin } = require('./assets');

function withAdminToken(value, run) {
  const original = process.env.ASSET_SYNC_ADMIN_TOKEN;

  if (value === undefined) {
    delete process.env.ASSET_SYNC_ADMIN_TOKEN;
  } else {
    process.env.ASSET_SYNC_ADMIN_TOKEN = value;
  }

  try {
    run();
  } finally {
    if (original === undefined) {
      delete process.env.ASSET_SYNC_ADMIN_TOKEN;
    } else {
      process.env.ASSET_SYNC_ADMIN_TOKEN = original;
    }
  }
}

function runAdminGuard(options = {}) {
  const expectedToken = Object.hasOwn(options, 'expectedToken') ? options.expectedToken : 'secret';
  const authorization = options.authorization || '';
  const req = {
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

  withAdminToken(expectedToken, () => {
    requireSyncAdmin(req, res, () => {
      nextCalled = true;
    });
  });

  return { nextCalled, statusCode: res.statusCode, payload: res.payload };
}

test('asset admin guard requires the admin token to be configured', () => {
  const result = runAdminGuard({ expectedToken: undefined, authorization: 'Bearer secret' });

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 503);
  assert.deepEqual(result.payload, { error: 'Asset sync admin token is not configured.' });
});

test('asset admin guard rejects missing and invalid bearer tokens', () => {
  assert.equal(runAdminGuard().statusCode, 401);
  assert.equal(runAdminGuard({ authorization: 'Bearer wrong' }).statusCode, 403);
});

test('asset admin guard allows matching bearer token', () => {
  const result = runAdminGuard({ authorization: 'Bearer secret' });

  assert.equal(result.nextCalled, true);
  assert.equal(result.statusCode, null);
  assert.equal(result.payload, null);
});
