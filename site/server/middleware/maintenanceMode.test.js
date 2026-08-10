const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const request = require('supertest');
const {
  maintenanceMode,
  isMaintenanceModeEnabled,
  isProductionRuntime
} = require('./maintenanceMode');

test('isProductionRuntime is true only for real production, not staging', () => {
  assert.equal(isProductionRuntime({ NODE_ENV: 'production' }), true);
  assert.equal(isProductionRuntime({ NODE_ENV: 'production', APP_ENV: 'staging' }), false);
  assert.equal(isProductionRuntime({ NODE_ENV: 'development' }), false);
});

test('isMaintenanceModeEnabled defaults on in production and off elsewhere, override wins both ways', () => {
  assert.equal(isMaintenanceModeEnabled({ NODE_ENV: 'production' }), true);
  assert.equal(isMaintenanceModeEnabled({ NODE_ENV: 'production', APP_ENV: 'staging' }), false);
  assert.equal(isMaintenanceModeEnabled({ NODE_ENV: 'development' }), false);
  assert.equal(isMaintenanceModeEnabled({ NODE_ENV: 'production', MAINTENANCE_MODE: 'false' }), false);
  assert.equal(isMaintenanceModeEnabled({ NODE_ENV: 'development', MAINTENANCE_MODE: 'true' }), true);
});

function buildApp() {
  const app = express();
  app.get('/healthz', (req, res) => res.json({ status: 'ok' }));
  app.use(maintenanceMode);
  app.use('/assets', express.static(__dirname));
  app.get('/api/ping', (req, res) => res.json({ ok: true }));
  app.get('/', (req, res) => res.send('<html>home</html>'));
  return app;
}

test('gated responses: 503.html for pages, JSON 503 for /api, Retry-After set, /healthz and /assets exempt', async () => {
  const previous = process.env.MAINTENANCE_MODE;
  process.env.MAINTENANCE_MODE = 'true';
  try {
    const app = buildApp();

    const health = await request(app).get('/healthz');
    assert.equal(health.status, 200);

    const asset = await request(app).get('/assets/maintenanceMode.js');
    assert.equal(asset.status, 200);

    const api = await request(app).get('/api/ping');
    assert.equal(api.status, 503);
    assert.deepEqual(api.body, { error: 'Site is temporarily unavailable.' });
    assert.ok(api.headers['retry-after']);

    const page = await request(app).get('/');
    assert.equal(page.status, 503);
    assert.match(page.text, /Temporarily Unavailable/);
    assert.equal(page.headers['cache-control'], 'no-store');
    assert.ok(page.headers['retry-after']);
  } finally {
    if (previous === undefined) delete process.env.MAINTENANCE_MODE;
    else process.env.MAINTENANCE_MODE = previous;
  }
});

test('gate off passes requests through untouched', async () => {
  const previous = process.env.MAINTENANCE_MODE;
  process.env.MAINTENANCE_MODE = 'false';
  try {
    const app = buildApp();
    const page = await request(app).get('/');
    assert.equal(page.status, 200);
    assert.match(page.text, /home/);
  } finally {
    if (previous === undefined) delete process.env.MAINTENANCE_MODE;
    else process.env.MAINTENANCE_MODE = previous;
  }
});
