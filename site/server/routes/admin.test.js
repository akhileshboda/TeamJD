const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const express = require('express');
const request = require('supertest');
const { createAdminRouter } = require('./admin');
const { resetStoreCache } = require('../services/mediaSlots');

async function buildApp(env) {
  resetStoreCache();
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'admin-route-'));
  const app = express();
  app.use('/api/admin', createAdminRouter({
    access: { env },
    storePath: path.join(dir, 'media-slots.json'),
    backup: async () => {}
  }));
  return app;
}

const devEnv = { NODE_ENV: 'development', CMS_DEV_BYPASS: 'true' };

test('the media API refuses unauthenticated requests in production', async () => {
  const configured = await buildApp({ NODE_ENV: 'production', CF_ACCESS_TEAM_DOMAIN: 'x.cloudflareaccess.com', CF_ACCESS_AUD: 'aud' });
  assert.equal((await request(configured).get('/api/admin/slots')).status, 401);
  assert.equal((await request(configured).post('/api/admin/slots/about.portrait/reset')).status, 401);

  const unconfigured = await buildApp({ NODE_ENV: 'production', CMS_DEV_BYPASS: 'true' });
  assert.equal((await request(unconfigured).get('/api/admin/slots')).status, 503);
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
  const unknown = await request(app).post('/api/admin/slots/nope.nothing/uploads').send({ fileName: 'a.jpg', size: 10 });
  assert.equal(unknown.status, 404);
  assert.match(unknown.body.error, /does not exist/);

  const alt = await request(app).put('/api/admin/slots/about.portrait/alt').send({ alt: 'Jake' });
  assert.equal(alt.status, 409);
  assert.match(alt.body.error, /Upload a photo/);
});
