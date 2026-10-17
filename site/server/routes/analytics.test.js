const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const express = require('express');
const request = require('supertest');
const { createAnalyticsRouter } = require('./analytics');
const { createAnalytics } = require('../services/analytics');

const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';

async function buildApp(env = { NODE_ENV: 'production' }) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'analytics-route-'));
  const analytics = createAnalytics({ dataDir });
  const app = express();
  app.use('/api/analytics', createAnalyticsRouter({ analytics, env }));
  return { app, analytics };
}

test('beacons are accepted as JSON or text and always answer 204', async () => {
  const { app, analytics } = await buildApp();
  const json = await request(app).post('/api/analytics/pv').set('User-Agent', BROWSER)
    .send({ path: '/about', visitStart: true, referrer: 'https://www.instagram.com/' });
  assert.equal(json.status, 204);
  const text = await request(app).post('/api/analytics/pv').set('User-Agent', BROWSER)
    .set('Content-Type', 'text/plain').send(JSON.stringify({ path: '/results', visitStart: false }));
  assert.equal(text.status, 204);
  const junk = await request(app).post('/api/analytics/pv').set('User-Agent', BROWSER)
    .set('Content-Type', 'application/json').send('{not json');
  assert.equal(junk.status, 204);

  const stats = await analytics.getStats('7d');
  assert.deepEqual(stats.current, { visits: 1, pageViews: 2 });
  assert.equal(stats.sources[0].source, 'Instagram');
});

test('admins browsing their own site are not counted', async () => {
  const { app, analytics } = await buildApp({ NODE_ENV: 'development', CMS_DEV_BYPASS: 'true' });
  await request(app).post('/api/analytics/pv').set('User-Agent', BROWSER).send({ path: '/', visitStart: true });
  assert.deepEqual((await analytics.getStats('7d')).current, { visits: 0, pageViews: 0 });
});
