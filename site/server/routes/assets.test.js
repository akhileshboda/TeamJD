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

test('public asset status exposes only the same fields as /healthz', async () => {
  const app = express();
  app.use('/api/assets', assetsRouter);

  const response = await request(app)
    .get('/api/assets/status')
    .set('CF-Connecting-IP', '203.0.113.71');
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.body).sort(), ['cacheReady', 'source', 'state']);
});

test('public manifest keeps render fields and drops storage internals', () => {
  const { toPublicManifest } = assetsRouter;
  const result = toPublicManifest({
    generatedAt: '2026-11-13T00:00:00.000Z',
    source: 'r2',
    assetCount: 1,
    byCategory: { home: ['hero'] },
    assets: {
      hero: {
        key: 'hero',
        category: 'home',
        url: 'https://cdn.example.com/site-assets/home/hero.webp?v=1',
        name: 'hero.webp',
        contentType: 'image/webp',
        width: 1200,
        height: 800,
        dropboxPath: '/assets/home/hero.jpg',
        originalDropboxPath: '/assets/home/hero.jpg',
        r2Key: 'site-assets/home/hero.webp',
        r2ObjectKey: 'site-assets/home/hero.webp',
        rev: 'abc',
        contentHash: 'def',
        originalSize: 123,
        originalName: 'hero.jpg'
      }
    }
  });

  assert.deepEqual(result.assets.hero, {
    key: 'hero',
    category: 'home',
    url: 'https://cdn.example.com/site-assets/home/hero.webp?v=1',
    name: 'hero.webp',
    contentType: 'image/webp',
    width: 1200,
    height: 800
  });
  assert.deepEqual(result.byCategory, { home: ['hero'] });
  assert.equal(result.assetCount, 1);
  assert.equal(JSON.stringify(result).includes('dropbox'), false);
});
