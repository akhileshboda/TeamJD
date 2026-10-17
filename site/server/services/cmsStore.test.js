const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createCmsStore } = require('./cmsStore');

const ORIGINAL_RESULTS = require('../seed/results-library.json');

async function tempStore(extra = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cms-store-'));
  const storePath = path.join(dir, 'cms.json');
  return { storePath, store: createCmsStore({ storePath, backup: null, ...extra }) };
}

const countStatuses = (rows) => rows.reduce((counts, { status }) => {
  counts[status] = (counts[status] || 0) + 1;
  return counts;
}, {});

test('a new store seeds 6 live client results, 114 hidden stock results and linked testimonials', async () => {
  const { store, storePath } = await tempStore();
  const results = await store.list('results');
  assert.equal(results.length, 120);
  assert.deepEqual(countStatuses(results), { published: 6, hidden: 114 });
  assert.equal(results[0].title, 'ANB champion with stage-ready control');
  assert.match(results[0].thumbnail, /client-posing-1/);

  const testimonials = await store.list('testimonials');
  assert.deepEqual(countStatuses(testimonials), { published: 6, hidden: 5 });
  const linked = await store.get('testimonials', 't-1');
  assert.deepEqual(linked.usage.map((use) => use.id), ['1']);

  const onDisk = JSON.parse(await fs.readFile(storePath, 'utf8'));
  assert.equal(onDisk.schemaVersion, 1);
  assert.deepEqual(onDisk.media, []);
});

test('public results are the original client records, apart from string ids and de-duplicated tags', async () => {
  const { store } = await tempStore();
  const expected = ORIGINAL_RESULTS
    .filter((item) => item.kind === 'client')
    .map((item) => ({ ...item, id: String(item.id), tags: [...new Set(item.tags)] }));
  // Key order matters too: the site and its tests read this exact JSON before.
  assert.equal(JSON.stringify(await store.getPublic('results')), JSON.stringify(expected));
  await assert.rejects(store.getPublic('testimonials'), { statusCode: 404 });
});

test('an existing store is never re-seeded, but a missing collection is', async () => {
  const { storePath } = await tempStore();
  await fs.writeFile(storePath, JSON.stringify({ schemaVersion: 1, collections: { results: [] }, media: [] }));
  const store = createCmsStore({ storePath, backup: null });
  assert.equal((await store.list('results')).length, 0);
  assert.equal((await store.list('testimonials')).length, 11);
});

test('a draft edit stays off the site until it is published, and discard reverts it', async () => {
  const { store } = await tempStore();
  const record = await store.get('results', '1');
  const edited = await store.saveDraft('results', '1', {
    draft: { ...record.draft, caption: 'New caption' },
    rev: record.rev
  }, 'jake@example.com');

  assert.equal(edited.status, 'changed');
  assert.equal(edited.updatedBy, 'jake@example.com');
  assert.equal((await store.getPublic('results'))[0].caption, ORIGINAL_RESULTS[0].caption);
  assert.deepEqual((await store.pending()).map((item) => [item.collection, item.id]), [['results', '1']]);

  const discarded = await store.apply('results', '1', 'discard', 'jake@example.com');
  assert.equal(discarded.status, 'published');
  assert.equal(discarded.draft.caption, ORIGINAL_RESULTS[0].caption);

  await store.saveDraft('results', '1', { draft: { ...record.draft, caption: 'New caption' }, rev: discarded.rev });
  const published = await store.apply('results', '1', 'publish');
  assert.equal(published.status, 'published');
  assert.equal((await store.getPublic('results'))[0].caption, 'New caption');
  assert.deepEqual(await store.pending(), []);
});

test('a save from a stale tab is refused', async () => {
  const { store } = await tempStore();
  const record = await store.get('results', '1');
  await store.saveDraft('results', '1', { draft: record.draft, rev: record.rev });
  await assert.rejects(store.saveDraft('results', '1', { draft: record.draft, rev: record.rev }), { statusCode: 409 });
  await assert.rejects(store.saveDraft('results', '1', { draft: record.draft }), { statusCode: 400 });
  // Nor can that tab publish or discard a draft it has not seen.
  await assert.rejects(store.apply('results', '1', 'publish', 'jake', record.rev), { statusCode: 409 });
  await assert.rejects(store.apply('results', '1', 'discard', 'jake', record.rev), { statusCode: 409 });
});

test('publishing or hiding elsewhere does not break an editor that is still open', async () => {
  const { store } = await tempStore();
  const record = await store.get('results', '1');
  const saved = await store.saveDraft('results', '1', { draft: { ...record.draft, caption: 'First' }, rev: record.rev });
  await store.bulk([{ collection: 'results', id: '1' }], 'publish', 'akhil');
  await store.apply('results', '1', 'unpublish', 'akhil');
  const next = await store.saveDraft('results', '1', { draft: { ...record.draft, caption: 'Second' }, rev: saved.rev });
  assert.equal(next.draft.caption, 'Second');
});

test('publishing an incomplete item is refused with the fields to fix', async () => {
  const { store } = await tempStore();
  const created = await store.create('results', { caption: 'Stage day' }, 'jake@example.com');
  assert.equal(created.status, 'draft');
  await assert.rejects(store.apply('results', created.id, 'publish'), (error) => {
    assert.equal(error.statusCode, 422);
    assert.deepEqual(Object.keys(error.fields).sort(), ['alt', 'image']);
    return true;
  });
  await assert.rejects(store.apply('results', created.id, 'discard'), { statusCode: 409 });
});

test('new items go to the top and reordering goes live immediately', async () => {
  const { store } = await tempStore();
  const created = await store.create('results', {
    caption: 'Stage day',
    alt: 'Athlete on stage',
    image: { src: 'https://cdn.example.com/stage.webp' }
  });
  assert.equal((await store.list('results'))[0].id, created.id);
  await store.apply('results', created.id, 'publish');
  assert.equal((await store.getPublic('results'))[0].id, created.id);

  const ids = (await store.list('results')).map((item) => item.id);
  const reordered = [...ids.slice(1), ids[0]];
  await store.reorder('results', reordered);
  assert.equal((await store.getPublic('results')).at(-1).id, created.id);
  await assert.rejects(store.reorder('results', reordered.slice(1)), { statusCode: 409 });
});

test('a hidden testimonial leaves its result; deleting it unlinks it everywhere', async () => {
  const { store } = await tempStore();
  await store.apply('testimonials', 't-1', 'unpublish');
  assert.equal((await store.getPublic('results'))[0].testimonial, undefined);

  await store.apply('testimonials', 't-1', 'delete');
  const result = await store.get('results', '1');
  assert.equal(result.draft.testimonialId, null);
  assert.equal(result.published.testimonialId, null);
  assert.equal(result.status, 'published');
});

test('bulk actions run in one write and report items that could not change', async () => {
  const { store } = await tempStore();
  const stock = (await store.list('results')).filter((item) => item.status === 'hidden').slice(0, 3);
  const incomplete = await store.create('results', {});
  const targets = [...stock, incomplete].map(({ id }) => ({ collection: 'results', id }));
  const outcome = await store.bulk(targets, 'publish');
  assert.deepEqual(outcome.done.map((item) => item.id), stock.map((item) => item.id));
  assert.equal(outcome.failed[0].id, incomplete.id);
  assert.equal(outcome.failed[0].fields.caption, 'Add a short caption.');

  await store.bulk(stock.map(({ id }) => ({ collection: 'results', id })), 'delete');
  assert.equal((await store.list('results')).length, 118);
});

test('preview shows the public list as if the draft were live, without saving it', async () => {
  const { store } = await tempStore();
  const record = await store.get('results', '2');
  const preview = await store.preview('results', '2', { ...record.draft, caption: 'Preview caption' });
  assert.equal(preview.results.find((item) => item.id === '2').caption, 'Preview caption');
  assert.notEqual((await store.get('results', '2')).draft.caption, 'Preview caption');

  const hidden = await store.preview('results', 'reference-competition-01', (await store.get('results', 'reference-competition-01')).draft);
  assert.ok(hidden.results.some((item) => item.id === 'reference-competition-01'));

  const quote = await store.preview('testimonials', 't-2', { quote: 'New words', author: 'Sam' });
  assert.equal(quote.results.find((item) => item.id === '2').testimonial.quote, 'New words');

  const fresh = await store.preview('results', null, { caption: 'Brand new', alt: 'x', image: { src: 'https://x/y.webp' } });
  assert.equal(fresh.results[0].caption, 'Brand new');
});

test('concurrent writes are serialised and all land', async () => {
  const { store, storePath } = await tempStore();
  await Promise.all(Array.from({ length: 10 }, (_, index) => store.create('testimonials', { quote: `Quote ${index}` })));
  const fresh = createCmsStore({ storePath, backup: null });
  assert.equal((await fresh.list('testimonials')).length, 21);
});

test('every write schedules a backup of the whole store', async () => {
  const backups = [];
  const { store } = await tempStore({ backup: (data) => backups.push(data) });
  await store.apply('results', '1', 'unpublish');
  assert.equal(backups.length, 1);
  assert.equal(backups[0].collections.results.find((item) => item.id === '1').published, null);
});

test('unknown collections, records and actions are clear errors', async () => {
  const { store } = await tempStore();
  assert.throws(() => store.list('pricing'), { statusCode: 404 });
  assert.throws(() => store.list('__proto__'), { statusCode: 404 });
  await assert.rejects(store.get('results', 'nope'), { statusCode: 404 });
  await assert.rejects(store.apply('results', '1', 'explode'), { statusCode: 400 });
});
