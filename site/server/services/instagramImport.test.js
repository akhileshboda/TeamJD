const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createCmsStore } = require('./cmsStore');
const { readImport, runInstagramImport } = require('./instagramImport');

async function tempStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ig-import-'));
  return createCmsStore({ storePath: path.join(dir, 'cms.json'), backup: null });
}

function fakeStorage({ configured = true, failAfter = Infinity } = {}) {
  const copies = [];
  return {
    copies,
    configured: () => configured,
    prefix: () => 'cms/test',
    publicUrl: (key) => `https://cdn.example/${key}`,
    async copy(request) {
      if (copies.length >= failAfter) throw new Error('R2 went away');
      copies.push(request);
    }
  };
}

const plan = readImport();
// Results live in a freshly seeded store, before any import.
const seedLive = require('../seed/results-library.json').filter((item) => item.kind === 'client' && !item.hidden);
const photoCount = plan.batches.reduce((sum, batch) => sum + batch.photos.length, 0);
const results = plan.batches.flatMap((batch) => batch.results);

test('the import file names a real photo for every result, with alt text and an audience', () => {
  const ids = new Set();
  for (const batch of plan.batches) {
    const keys = new Set(batch.photos.map((photo) => photo.key));
    for (const result of batch.results) {
      assert.ok(keys.has(result.key), `${result.key} is in its batch's photo list`);
      assert.ok(result.alt && result.caption, `${result.id} has alt text and a caption`);
      assert.ok(['competitor', 'transformation', 'everyday'].includes(result.audience), `${result.id} has an audience`);
      assert.ok(!ids.has(result.id), `${result.id} is unique`);
      ids.add(result.id);
    }
  }
  assert.equal(plan.batches[0].photos.length, 52);
  const audiences = new Set(results.map((result) => result.audience));
  assert.deepEqual([...audiences].sort(), ['competitor', 'everyday', 'transformation']);
  // House style for result copy: no long dashes.
  for (const result of results) assert.ok(!/[—–]/.test(`${result.caption} ${result.name}`), `${result.id} has no dashes`);
  // At least ten different competitors; transformations and everyday clients are
  // whatever Jake's Instagram genuinely holds (see media-provenance.md).
  assert.ok(new Set(results.filter((result) => result.audience === 'competitor').map((result) => result.id)).size >= 10);
});

test('copies every photo into this environment\'s library and publishes the results, ahead of the old ones', async () => {
  const store = await tempStore();
  const storage = fakeStorage();
  const outcome = await runInstagramImport(store, { plan, storage });

  assert.equal(outcome.status, 'imported');
  assert.deepEqual(outcome.batches.map(({ photos, results: made }) => [photos, made]),
    plan.batches.map((batch) => [batch.photos.length, batch.results.length]));
  // Copied from the shared imports/ prefix, never moved or deleted.
  assert.ok(storage.copies.every(({ sourceKey, objectKey }) => sourceKey.startsWith('imports/instagram/') && objectKey.startsWith('cms/test/')));

  const media = await store.listMedia();
  assert.equal(media.length, photoCount);
  const live = await store.getPublic('results');
  assert.equal(live.length, seedLive.length + results.length);
  // Later batches open the library; each batch keeps its own order.
  const expected = [...plan.batches].reverse().flatMap((batch) => batch.results.map((result) => result.id));
  assert.deepEqual(live.slice(0, results.length).map((result) => result.id), expected);
  for (const result of live.slice(0, results.length)) {
    assert.equal(result.kind, 'client');
    assert.match(result.src, /^https:\/\/cdn\.example\/cms\/test\//);
  }
  // Old results keep their place after the import.
  assert.equal(live[results.length].id, String(seedLive[0].id));
});

test('never runs twice', async () => {
  const store = await tempStore();
  await runInstagramImport(store, { plan, storage: fakeStorage() });
  const again = fakeStorage();
  assert.equal((await runInstagramImport(store, { plan, storage: again })).status, 'done-before');
  assert.equal(again.copies.length, 0);
  assert.equal((await store.listMedia()).length, photoCount);
});

test('a store that had the first batch only gets the new one', async () => {
  const store = await tempStore();
  await runInstagramImport(store, { plan: { batches: [plan.batches[0]] }, storage: fakeStorage() });
  const storage = fakeStorage();
  const outcome = await runInstagramImport(store, { plan, storage });
  assert.deepEqual(outcome.batches.map((batch) => batch.batch), plan.batches.slice(1).map((batch) => batch.id));
  assert.equal(storage.copies.length, photoCount - 52);
  assert.equal((await store.getPublic('results')).length, seedLive.length + results.length);
});

test('does nothing without R2', async () => {
  const store = await tempStore();
  const outcome = await runInstagramImport(store, { plan, storage: fakeStorage({ configured: false }) });
  assert.equal(outcome.status, 'skipped');
  assert.equal((await store.listMedia()).length, 0);
});

test('a run cut short leaves the store untouched, and the next run finishes the job', async () => {
  const store = await tempStore();
  await assert.rejects(runInstagramImport(store, { plan, storage: fakeStorage({ failAfter: 10 }) }), /R2 went away/);
  assert.equal((await store.listMedia()).length, 0);
  assert.equal((await store.getPublic('results')).length, seedLive.length);

  const retry = fakeStorage();
  const outcome = await runInstagramImport(store, { plan, storage: retry });
  assert.equal(outcome.status, 'imported');
  assert.equal((await store.listMedia()).length, photoCount);
  // The retry writes to the same keys as the failed run, so nothing is left behind.
  assert.equal(new Set(retry.copies.map(({ objectKey }) => objectKey)).size, photoCount);
  assert.ok(retry.copies.slice(0, 10).every(({ objectKey }, index) => objectKey === `cms/test/instagram-${plan.batches[0].photos[index].key}`));
});
