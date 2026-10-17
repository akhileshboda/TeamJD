const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const express = require('express');
const request = require('supertest');
const { createAdminRouter } = require('./admin');
const { resetStoreCache } = require('../services/mediaSlots');
const { createAnalytics } = require('../services/analytics');

async function buildApp(env) {
  resetStoreCache();
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'admin-route-'));
  const app = express();
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'admin-stats-'));
  app.use('/api/admin', createAdminRouter({
    access: { env },
    analytics: createAnalytics({ dataDir }),
    storePath: path.join(dir, 'media-slots.json'),
    backup: async () => {}
  }));
  return app;
}

const devEnv = { NODE_ENV: 'development', CMS_DEV_BYPASS: 'true' };

test('the dashboard API refuses signed-out and cross-site requests', async () => {
  // The dev bypass is never honoured in production (staging runs NODE_ENV=production too).
  const production = await buildApp({ NODE_ENV: 'production', CMS_DEV_BYPASS: 'true' });
  assert.equal((await request(production).get('/api/admin/slots')).status, 401);
  assert.equal((await request(production).get('/api/admin/stats')).status, 401);
  const write = await request(production).post('/api/admin/slots/about.portrait/reset').set('Sec-Fetch-Site', 'same-origin');
  assert.equal(write.status, 401);

  const dev = await buildApp(devEnv);
  assert.equal((await request(dev).post('/api/admin/slots/about.portrait/reset').set('Sec-Fetch-Site', 'cross-site')).status, 403);
});

test('stats are served to signed-in admins', async () => {
  const res = await request(await buildApp(devEnv)).get('/api/admin/stats?range=7d');
  assert.equal(res.status, 200);
  assert.equal(res.body.range, '7d');
  assert.equal(res.body.daily.length, 7);
});

test('slots are listed with their page, guidance and current state', async () => {
  const res = await request(await buildApp(devEnv)).get('/api/admin/slots');
  assert.equal(res.status, 200);
  const portrait = res.body.slots.find((slot) => slot.id === 'about.portrait');
  assert.equal(portrait.page, 'About');
  assert.match(portrait.hint, /Portrait/);
  assert.equal(portrait.current, null);
  assert.deepEqual(portrait.history, []);
  assert.ok(res.body.slots.some((slot) => slot.id === 'services.posing-only.hero'));
});

test('unknown slots and premature alt text get clear errors', async () => {
  const app = await buildApp(devEnv);
  const unknown = await request(app).post('/api/admin/slots/nope.nothing/uploads').set('Sec-Fetch-Site', 'same-origin').send({ fileName: 'a.jpg', size: 10 });
  assert.equal(unknown.status, 404);
  assert.match(unknown.body.error, /does not exist/);

  const alt = await request(app).put('/api/admin/slots/about.portrait/alt').set('Sec-Fetch-Site', 'same-origin').send({ alt: 'Jake' });
  assert.equal(alt.status, 409);
  assert.match(alt.body.error, /Upload a photo/);
});
