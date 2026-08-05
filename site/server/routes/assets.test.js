const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const request = require('supertest');
const assetsRouter = require('./assets');
const { requireSyncAdmin } = assetsRouter;

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

test('asset refresh is state-changing only over authenticated POST', async () => {
  const app = express();
  app.use('/api/assets', assetsRouter);

  const response = await request(app)
    .get('/api/assets/refresh')
    .set('CF-Connecting-IP', '203.0.113.70');
  assert.equal(response.status, 405);
  assert.equal(response.headers.allow, 'POST');
});

test('asset discovery requires an admin token in every environment', async () => {
  const app = express();
  app.use('/api/assets', assetsRouter);

  const previous = process.env.ASSET_SYNC_ADMIN_TOKEN;
  process.env.ASSET_SYNC_ADMIN_TOKEN = 'discovery-secret';
  try {
    const missing = await request(app)
      .get('/api/assets/discover')
      .set('CF-Connecting-IP', '203.0.113.71');
    assert.equal(missing.status, 401);

    const invalid = await request(app)
      .get('/api/assets/discover')
      .set('Authorization', 'Bearer wrong')
      .set('CF-Connecting-IP', '203.0.113.72');
    assert.equal(invalid.status, 403);
  } finally {
    if (previous === undefined) delete process.env.ASSET_SYNC_ADMIN_TOKEN;
    else process.env.ASSET_SYNC_ADMIN_TOKEN = previous;
  }
});
