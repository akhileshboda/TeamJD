const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const express = require('express');
const request = require('supertest');
const { createCmsStore } = require('./cmsStore');
const { DEFAULT_SETTINGS } = require('./cmsSettings');
const { buildSitemap } = require('./sitemap');
const { isMaintenanceModeEnabled } = require('../middleware/maintenanceMode');
const { createAdminRouter } = require('../routes/admin');
const { createAnalytics } = require('./analytics');

async function tempStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cms-settings-'));
  return { dir, store: createCmsStore({ storePath: path.join(dir, 'cms.json'), backup: null }) };
}

test('settings start from the site as it is today and apply immediately', async () => {
  const { store } = await tempStore();
  assert.deepEqual(await store.getSettings(), DEFAULT_SETTINGS);
  assert.equal(store.cachedSettings().contact.email, 'jake@team-jd.com.au');

  const saved = await store.updateSettings('contact', {
    email: ' Jake@Team-JD.com.au ',
    instagramUrl: 'https://www.instagram.com/newhandle/',
    instagramHandle: '@newhandle',
    facebookUrl: ''
  }, 'jake@team-jd.com.au');
  assert.deepEqual(saved.contact, {
    email: 'jake@team-jd.com.au', instagramUrl: 'https://www.instagram.com/newhandle/', instagramHandle: 'newhandle', facebookUrl: ''
  });
  assert.equal((await store.getPublic('settings')).contact.instagramHandle, 'newhandle');
});

test('bad links and addresses are refused with the fields to fix', async () => {
  const { store } = await tempStore();
  await assert.rejects(store.updateSettings('contact', { email: 'nope', instagramUrl: 'instagram.com/x', facebookUrl: 'http://x.com' }), (error) => {
    assert.equal(error.statusCode, 422);
    assert.deepEqual(Object.keys(error.fields).sort(), ['email', 'facebookUrl', 'instagramUrl']);
    return true;
  });
  await assert.rejects(store.updateSettings('enquiries', { sendTo: 'jake at gmail' }), { statusCode: 422 });
  await assert.rejects(store.updateSettings('billing', {}), { statusCode: 404 });
});

test('the public site never sees where enquiries go or the site controls', async () => {
  const { store } = await tempStore();
  await store.updateSettings('enquiries', { sendTo: 'jake@team-jd.com.au' });
  await store.updateSettings('seo', { about: { title: 'Meet Jake', description: 'Coach and athlete.' } });
  const visible = await store.getPublic('settings');
  assert.deepEqual(Object.keys(visible), ['contact', 'seo']);
  assert.deepEqual(visible.seo.about, { title: 'Meet Jake', description: 'Coach and athlete.' });
  assert.deepEqual(visible.seo.home, { title: '', description: '' });
});

test('the dashboard switch beats .env for the under-construction page', () => {
  const production = { NODE_ENV: 'production' };
  const withVisibility = (visibility) => ({ site: { visibility } });
  assert.equal(isMaintenanceModeEnabled(production, withVisibility('default')), true);
  assert.equal(isMaintenanceModeEnabled(production, withVisibility('live')), false);
  assert.equal(isMaintenanceModeEnabled({ NODE_ENV: 'development' }, withVisibility('maintenance')), true);
  assert.equal(isMaintenanceModeEnabled(production, null), true, 'no store yet: .env decides');
});

test('the sitemap lists every live service between the main pages', () => {
  const xml = buildSitemap({
    baseUrl: 'https://team-jd.com.au/',
    services: [{ slug: 'posing-only' }, { slug: 'online-coaching' }],
    lastmod: '2026-10-18'
  });
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(locs, [
    'https://team-jd.com.au/', 'https://team-jd.com.au/about', 'https://team-jd.com.au/services',
    'https://team-jd.com.au/services/posing-only', 'https://team-jd.com.au/services/online-coaching',
    'https://team-jd.com.au/results', 'https://team-jd.com.au/contact', 'https://team-jd.com.au/privacy'
  ]);
  assert.match(xml, /<lastmod>2026-10-18<\/lastmod>/);
});

test('the settings API saves a section and reports what is in effect', async () => {
  const { dir, store } = await tempStore();
  const app = express();
  app.use('/api/admin', createAdminRouter({
    access: { env: { NODE_ENV: 'development', CMS_DEV_BYPASS: 'true' } },
    analytics: createAnalytics({ dataDir: dir }),
    store
  }));
  const view = await request(app).get('/api/admin/settings');
  assert.equal(view.status, 200);
  assert.equal(view.body.bookingLinks.length, 4);
  assert.equal(view.body.bookingLinks.find((link) => link.id === 'competition-prep').applicationUrl.startsWith('https://'), true);

  const saved = await request(app).put('/api/admin/settings/site').set('Sec-Fetch-Site', 'same-origin').send({ visibility: 'maintenance' });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.settings.site.visibility, 'maintenance');
  assert.equal(saved.body.siteIsLive, false);

  const refused = await request(app).put('/api/admin/settings/contact').set('Sec-Fetch-Site', 'same-origin').send({ email: 'x' });
  assert.equal(refused.status, 422);
});
