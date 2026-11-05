const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const express = require('express');
const request = require('supertest');
const { createAdminRouter } = require('./admin');
const { createAnalytics } = require('../services/analytics');
const { createCmsStore } = require('../services/cmsStore');

const devEnv = { NODE_ENV: 'development', CMS_DEV_BYPASS: 'true' };

async function buildApp(env = devEnv) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'admin-route-'));
  const store = createCmsStore({ storePath: path.join(dir, 'cms.json'), backup: null });
  const removed = [];
  const app = express();
  app.use('/api/admin', createAdminRouter({
    access: { env },
    analytics: createAnalytics({ dataDir: dir }),
    store,
    removeFiles: async (asset) => removed.push(asset.id)
  }));
  const write = (method, url) => request(app)[method](url).set('Sec-Fetch-Site', 'same-origin');
  return { app, store, write, removed };
}

const photo = (id, extra = {}) => ({
  id, kind: 'image', url: `https://cdn.example/cms/test/${id}.webp`, posterUrl: null, width: 2000, height: 1500,
  r2Keys: [`cms/test/${id}.webp`], alt: '', originalName: `${id}.jpg`, uploadedAt: '2026-10-18T00:00:00.000Z', ...extra
});

test('the dashboard API refuses signed-out and cross-site requests', async () => {
  // The dev bypass is never honoured in production (staging runs NODE_ENV=production too).
  const { app: production } = await buildApp({ NODE_ENV: 'production', CMS_DEV_BYPASS: 'true' });
  assert.equal((await request(production).get('/api/admin/placements')).status, 401);
  assert.equal((await request(production).get('/api/admin/stats')).status, 401);
  assert.equal((await request(production).get('/api/admin/collections/results')).status, 401);

  const { write } = await buildApp();
  assert.equal((await write('put', '/api/admin/placements/about.portrait').set('Sec-Fetch-Site', 'cross-site').send({})).status, 403);
});

test('stats are served to signed-in admins', async () => {
  const { app } = await buildApp();
  const res = await request(app).get('/api/admin/stats?range=7d');
  assert.equal(res.status, 200);
  assert.equal(res.body.daily.length, 7);
});

test('photo spots: choose a library photo as a draft, publish it, and the site gets it', async () => {
  const { app, store, write } = await buildApp();
  await store.addMedia(photo('p1'));

  const listed = await request(app).get('/api/admin/placements');
  const portrait = listed.body.slots.find((slot) => slot.id === 'about.portrait');
  assert.equal(portrait.page, 'About');
  assert.equal(portrait.pagePath, '/about');
  assert.equal(portrait.record, null);
  assert.equal(portrait.aspect, '3 / 4');

  const chosen = await write('put', '/api/admin/placements/about.portrait')
    .send({ assetId: 'p1', alt: 'Jake on stage', focus: { x: 30, y: 20 }, zoom: 1.5, rev: 0 });
  assert.equal(chosen.status, 200);
  assert.equal(chosen.body.status, 'draft');
  assert.deepEqual(await store.getPublic('slots'), {});

  const preview = await write('post', '/api/admin/collections/placements/preview').send({ id: 'about.portrait', draft: chosen.body.draft });
  assert.equal(preview.body.slots['about.portrait'].url, 'https://cdn.example/cms/test/p1.webp');

  const noAlt = await write('put', '/api/admin/placements/home.about-photo').send({ assetId: 'p1', alt: '', rev: 0 });
  const refused = await write('post', '/api/admin/collections/placements/home.about-photo/publish');
  assert.equal(refused.status, 422);
  assert.ok(refused.body.fields.alt);
  assert.equal(noAlt.status, 200);

  const published = await write('post', '/api/admin/collections/placements/about.portrait/publish');
  assert.equal(published.status, 200);
  assert.deepEqual(await store.getPublic('slots'), {
    'about.portrait': {
      kind: 'image', url: 'https://cdn.example/cms/test/p1.webp', posterUrl: null, alt: 'Jake on stage', focus: { x: 30, y: 20 }, zoom: 1.5,
      trim: null
    }
  });

  const pending = await request(app).get('/api/admin/pending');
  assert.deepEqual(pending.body.items.map((item) => item.title), ['“Meet Jake” photo']);
});

const clip = (id, extra = {}) => ({
  ...photo(id), kind: 'video', url: `https://cdn.example/cms/test/${id}.mp4`, posterUrl: `https://cdn.example/cms/test/${id}-poster.jpg`,
  duration: 20, ...extra
});

test('the Contact reel is framed to its shape and can loop just part of the video', async () => {
  const { app, store, write } = await buildApp();
  await store.addMedia(clip('v1'));

  const listed = await request(app).get('/api/admin/placements');
  const reel = listed.body.slots.find((slot) => slot.id === 'contact.reel');
  assert.equal(reel.aspect, '21 / 7');
  assert.match(reel.hint, /part that loops/);

  const publish = () => write('post', '/api/admin/collections/placements/contact.reel/publish');
  const choose = async (body) => {
    const { body: current } = await request(app).get('/api/admin/placements');
    const rev = current.slots.find((slot) => slot.id === 'contact.reel').record?.rev ?? 0;
    return write('put', '/api/admin/placements/contact.reel').send({ assetId: 'v1', focus: { x: 40, y: 60 }, zoom: 1.2, rev, ...body });
  };

  // Seconds are kept to a tenth.
  const saved = await choose({ trim: { start: 2.04, end: 9.96 } });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.draft.trim, { start: 2, end: 10 });

  for (const [trim, message] of [
    [{ start: 5, end: 6 }, /at least 2 seconds/],
    [{ start: 8, end: 4 }, /after the start/],
    [{ start: -1, end: 4 }, /after the start/],
    [{ start: 10, end: 25 }, /only 0:20 long/]
  ]) {
    await choose({ trim });
    const refused = await publish();
    assert.equal(refused.status, 422, JSON.stringify(trim));
    assert.match(refused.body.fields.trim, message);
    assert.doesNotMatch(refused.body.fields.trim, /server/i);
  }

  await choose({ trim: { start: 3, end: 12.5 } });
  assert.equal((await publish()).status, 200);
  assert.deepEqual((await store.getPublic('slots'))['contact.reel'], {
    kind: 'video', url: 'https://cdn.example/cms/test/v1.mp4', posterUrl: 'https://cdn.example/cms/test/v1-poster.jpg',
    alt: '', focus: { x: 40, y: 60 }, zoom: 1.2, trim: { start: 3, end: 12.5 }
  });

  // No trim, or one that is not a pair of numbers, plays the whole video.
  assert.equal((await choose({ trim: { start: 'soon', end: 4 } })).body.draft.trim, null);
  assert.equal((await choose({})).body.draft.trim, null);
});

test('a trim sent with a photo is dropped', async () => {
  const { store, write } = await buildApp();
  await store.addMedia(photo('p1'));
  const saved = await write('put', '/api/admin/placements/about.portrait')
    .send({ assetId: 'p1', alt: 'Jake', trim: { start: 1, end: 5 }, rev: 0 });
  assert.equal(saved.body.draft.trim, null);
});

test('photo spots refuse the wrong kind of file and unknown spots', async () => {
  const { store, write } = await buildApp();
  await store.addMedia(photo('p1'));
  assert.equal((await write('put', '/api/admin/placements/contact.reel').send({ assetId: 'p1', rev: 0 })).status, 400);
  assert.equal((await write('put', '/api/admin/placements/nope.nothing').send({ rev: 0 })).status, 404);
  assert.equal((await write('put', '/api/admin/placements/about.portrait').send({ assetId: 'missing', rev: 0 })).status, 404);
});

test('media in use cannot be deleted; unused media is removed with its files', async () => {
  const { app, store, write, removed } = await buildApp();
  await store.addMedia(photo('used'));
  await store.addMedia(photo('spare'));
  await write('put', '/api/admin/placements/about.portrait').send({ assetId: 'used', rev: 0 });

  const library = await request(app).get('/api/admin/media');
  assert.deepEqual(library.body.items.find((item) => item.id === 'used').usage.map((use) => use.id), ['about.portrait']);

  const blocked = await write('delete', '/api/admin/media/used');
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.error, /About: Main portrait/);

  const alt = await write('patch', '/api/admin/media/spare').send({ alt: 'Gym floor' });
  assert.equal(alt.body.alt, 'Gym floor');
  assert.equal((await write('delete', '/api/admin/media/spare')).status, 200);
  assert.deepEqual(removed, ['spare']);
});

test('uploads are refused clearly for unsupported files', async () => {
  const { write } = await buildApp();
  const heic = await write('post', '/api/admin/media/uploads').send({ fileName: 'IMG_1.HEIC', size: 100 });
  assert.equal(heic.status, 415);
  assert.match(heic.body.error, /HEIC/);
});
