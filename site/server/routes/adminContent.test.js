const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const express = require('express');
const request = require('supertest');
const { createAdminRouter } = require('./admin');
const { createContentRouter } = require('./content');
const { createCmsStore } = require('../services/cmsStore');
const { createAnalytics } = require('../services/analytics');

async function buildApp() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'admin-content-'));
  const store = createCmsStore({ storePath: path.join(dir, 'cms.json'), backup: null });
  const app = express();
  app.use('/api/content', createContentRouter({ store }));
  app.use('/api/admin', createAdminRouter({
    access: { env: { NODE_ENV: 'development', CMS_DEV_BYPASS: 'true' } },
    analytics: createAnalytics({ dataDir: dir }),
    store
  }));
  const write = (method, url) => request(app)[method](url).set('Sec-Fetch-Site', 'same-origin');
  return { app, write };
}

test('edit, preview, publish: the public site only changes on publish', async () => {
  const { app, write } = await buildApp();
  const list = await request(app).get('/api/admin/collections/results');
  assert.equal(list.status, 200);
  assert.equal(list.body.items.length, 120);

  const record = (await request(app).get('/api/admin/collections/results/1')).body;
  const saved = await write('put', '/api/admin/collections/results/1').send({ draft: { ...record.draft, caption: 'Edited' }, rev: record.rev });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.status, 'changed');

  const preview = await write('post', '/api/admin/collections/results/preview').send({ id: '1', draft: saved.body.draft });
  assert.equal(preview.body.results[0].caption, 'Edited');
  assert.notEqual((await request(app).get('/api/content/results')).body[0].caption, 'Edited');

  const pending = await request(app).get('/api/admin/pending');
  assert.deepEqual(pending.body.items.map((item) => item.id), ['1']);

  const published = await write('post', '/api/admin/publish').send({ all: true });
  assert.deepEqual(published.body.done, [{ collection: 'results', id: '1' }]);
  assert.equal((await request(app).get('/api/content/results')).body[0].caption, 'Edited');
});

test('validation, conflicts and bad actions come back as clear errors', async () => {
  const { app, write } = await buildApp();
  const created = await write('post', '/api/admin/collections/results').send({ draft: { caption: 'Half done' } });
  assert.equal(created.status, 201);

  const publish = await write('post', `/api/admin/collections/results/${created.body.id}/publish`);
  assert.equal(publish.status, 422);
  assert.ok(publish.body.fields.image);

  const stale = await write('put', `/api/admin/collections/results/${created.body.id}`).send({ draft: {}, rev: 99 });
  assert.equal(stale.status, 409);

  assert.equal((await write('post', '/api/admin/collections/results/1/explode')).status, 400);
  assert.equal((await write('post', '/api/admin/collections/results/bulk').send({ action: 'explode', ids: ['1'] })).status, 400);
  assert.equal((await request(app).get('/api/admin/collections/nope')).status, 404);
  assert.equal((await request(app).get('/api/content/testimonials')).status, 404);
});

test('bulk hide, reorder and delete', async () => {
  const { app, write } = await buildApp();
  const hidden = await write('post', '/api/admin/collections/results/bulk').send({ action: 'unpublish', ids: ['1', '2'] });
  assert.equal(hidden.body.done.length, 2);
  assert.deepEqual((await request(app).get('/api/content/results')).body.map((item) => item.id), ['3', '4', '5', '6']);

  const ids = (await request(app).get('/api/admin/collections/results')).body.items.map((item) => item.id).reverse();
  const reordered = await write('put', '/api/admin/collections/results/order').send({ ids });
  assert.equal(reordered.status, 200);
  assert.deepEqual((await request(app).get('/api/content/results')).body.map((item) => item.id), ['6', '5', '4', '3']);

  const removed = await write('delete', '/api/admin/collections/testimonials/t-3');
  assert.equal(removed.status, 200);
  assert.equal((await request(app).get('/api/content/results')).body.find((item) => item.id === '3').testimonial, undefined);
});
