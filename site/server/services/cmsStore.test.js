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

test('a new store seeds 2 live client results with their testimonials, and 4 hidden retired stage shots', async () => {
  const { store, storePath } = await tempStore();
  const results = await store.list('results');
  assert.equal(results.length, 6);
  assert.deepEqual(countStatuses(results), { published: 2, hidden: 4 });
  assert.equal(results[0].title, 'Akhil took gold at ANB');
  assert.match(results[0].thumbnail, /client-posing-1/);

  const first = await store.get('results', '1');
  assert.equal(first.draft.testimonial.quote, ORIGINAL_RESULTS[0].testimonial.quote);

  const onDisk = JSON.parse(await fs.readFile(storePath, 'utf8'));
  assert.equal(onDisk.schemaVersion, 2);
  assert.equal(onDisk.collections.testimonials, undefined);
  assert.deepEqual(onDisk.media, []);
});

test('public results are the live seed client records, apart from string ids, audience and de-duplicated tags', async () => {
  const { store } = await tempStore();
  const audienceByCategory = { competition: 'competitor', posing: 'competitor' };
  const expected = ORIGINAL_RESULTS
    .filter((item) => item.kind === 'client' && !item.hidden)
    // Public output leaves out an empty stats list.
    .map(({ hidden, stats, ...item }) => (stats?.length ? { ...item, stats } : item))
    .map(({ category, ...item }) => ({
      ...Object.fromEntries(Object.entries(item).flatMap(([key, value]) =>
        // Audience sits straight after category; seed records take it from their category.
        key === 'kind' ? [['category', category], ['audience', audienceByCategory[category]], [key, value]] : [[key, value]])),
      id: String(item.id),
      // Every framed photo now also says how far it is zoomed in (1 = not at all).
      ...(item.presentation && { presentation: { ...item.presentation, zoom: 1 } }),
      tags: [...new Set(item.tags)]
    }));
  // Key order matters too: the site and its tests read this exact JSON before.
  assert.equal(JSON.stringify(await store.getPublic('results')), JSON.stringify(expected));
  await assert.rejects(store.getPublic('testimonials'), { statusCode: 404 });
});

test('stores seeded before November 2026 hide four of Akhil\'s shots and take the new copy once, keeping wording Jake changed', async () => {
  const { storePath } = await tempStore();
  const seed = Object.fromEntries(ORIGINAL_RESULTS.map((item) => [String(item.id), item]));
  const OLD = {
    1: ['ANB Champion — Competition Prep Client', 'ANB champion with stage-ready control', 'A full prep result built around tighter presentation, clearer conditioning, and confidence when it mattered.'],
    4: ['Stage Presence — Online Coaching Client', 'Presentation that translated under lights', 'A posing-focused result built around angles, transitions, breathing, and making the physique read from the judging table.']
  };
  const OLD_EXTRAS = {
    1: { duration: '16 Weeks', stats: [{ label: 'Service', value: 'Prep' }, { label: 'Outcome', value: 'Gold', trend: 'up' }, { label: 'Focus', value: 'Stage' }], testimonial: { quote: 'Real words one', author: 'ANB Champion', service: 'Competition Preparation', result: 'Gold Medal Stage Result' } },
    4: { duration: '8 Weeks', stats: [{ label: 'Service', value: 'Posing' }, { label: 'Focus', value: 'Angles' }, { label: 'Confidence', value: 'Higher', trend: 'up' }], testimonial: { quote: 'Real words four', author: 'Posing Client', service: 'Posing', result: 'Stage Presence Transformation' } }
  };
  // A store as the old seed made it: all six original client results live, with the old copy.
  const old = (id, extra = {}) => {
    const [caption, name, summary] = OLD[id] || [`old ${id}`, `old name ${id}`, `old summary ${id}`];
    const extras = OLD_EXTRAS[id] || { duration: '', stats: [], testimonial: null };
    const draft = { caption, alt: 'a', name, summary, category: 'competition', kind: 'client', featured: true, image: { assetId: null, src: seed[id].src }, presentation: null, tags: [], ...structuredClone(extras) };
    return { id: String(id), order: id, draft, published: structuredClone(draft), rev: 1, updatedBy: 'seed', publishedAt: 'then', hiddenAt: null, ...extra };
  };
  const one = old(1, { updatedBy: 'jake@example.com', rev: 6 });
  one.draft.caption = one.published.caption = 'Jake wrote this';
  one.draft.duration = one.published.duration = '12 weeks';
  const two = old(2, { updatedBy: 'jake@example.com', rev: 3 });
  // Jake swapped the photo on 5 and published it, so it is not Akhil any more and stays live.
  const five = old(5, { updatedBy: 'jake@example.com', rev: 2 });
  five.draft.image.src = five.published.image.src = 'https://cdn.example/someone-else.webp';
  // On 6 he swapped the photo in a draft only, so the live version is still Akhil and goes.
  const six = old(6, { updatedBy: 'jake@example.com', rev: 2 });
  six.draft.image.src = 'https://cdn.example/new-draft.webp';
  await fs.writeFile(storePath, JSON.stringify({ schemaVersion: 2, collections: { results: [one, two, old(3), old(4), five, six] }, media: [] }));
  const store = createCmsStore({ storePath, backup: null });

  const live = await store.getPublic('results');
  // 2, 3 and 6 are hidden, including 2 whose words had been edited; 5 now shows someone else.
  assert.deepEqual(live.map((result) => result.id), ['1', '4', '5']);
  assert.equal((await store.get('results', '2')).status, 'hidden');
  // 6 keeps Jake's unpublished draft with the new photo.
  const sixAfter = await store.get('results', '6');
  assert.equal(sixAfter.published, null);
  assert.equal(sixAfter.draft.image.src, 'https://cdn.example/new-draft.webp');
  // 4 still had the old seed copy, so it takes all of the new copy.
  const four = live.find((item) => item.id === '4');
  assert.deepEqual([four.caption, four.name, four.summary], [seed[4].caption, seed[4].name, seed[4].summary]);
  // 1 keeps the caption Jake wrote; the fields he had not touched take the new copy.
  // The made-up length, stats and anonymous labels go; the quotes stay.
  assert.equal(four.duration, undefined);
  assert.equal(four.stats, undefined);
  assert.deepEqual(four.testimonial, { quote: 'Real words four', author: 'Akhil', service: 'Posing', result: '' });
  const first = live.find((item) => item.id === '1');
  assert.equal(first.caption, 'Jake wrote this');
  assert.equal(first.duration, '12 weeks');
  assert.equal(first.stats, undefined);
  assert.deepEqual(first.testimonial, { quote: 'Real words one', author: 'Akhil', service: 'Competition Preparation', result: 'Gold at ANB' });
  assert.deepEqual([first.name, first.summary], [seed[1].name, seed[1].summary]);
  assert.equal(first.src, seed[1].src);

  const onDisk = JSON.parse(await fs.readFile(storePath, 'utf8'));
  assert.ok(onDisk.migrations.includes('seed-results-2026-11'));
  for (const index of [1, 2, 5]) assert.ok(onDisk.collections.results[index].hiddenAt, `record ${index + 1} records when it was hidden`);
  assert.equal(onDisk.collections.results[4].hiddenAt, null);
  // Runs once: a record re-published later is not hidden again.
  onDisk.collections.results[1].published = onDisk.collections.results[1].draft;
  await fs.writeFile(storePath, JSON.stringify(onDisk));
  const reloaded = createCmsStore({ storePath, backup: null });
  assert.ok((await reloaded.getPublic('results')).some((item) => item.id === '2'));
});

test('stores seeded with the 114 stock example photos drop them once, keeping any given an uploaded photo', async () => {
  const { storePath } = await tempStore();
  const stock = (id, image = { assetId: null, src: 'https://images.unsplash.com/x.jpg' }) => {
    const draft = { caption: `Stock ${id}`, alt: 'a', category: 'training', kind: 'representative', featured: false, image, presentation: null, tags: [] };
    return { id, order: 10, draft, published: null, rev: 1, updatedBy: 'seed', publishedAt: null, hiddenAt: 'then' };
  };
  const mine = { ...stock('42'), draft: { ...stock('42').draft, caption: 'Jake added this one' } };
  const swapped = stock('reference-training-07', { assetId: 'upload-1', src: '/media/upload-1.webp' });
  const results = [stock('reference-competition-01'), stock('reference-posing-12'), stock('reference-online-03'), stock('reference-lifestyle-09'), stock('reference-training-24'), swapped, mine];
  await fs.writeFile(storePath, JSON.stringify({ schemaVersion: 2, collections: { results }, media: [], migrations: ['seed-results-2026-11'] }));

  const store = createCmsStore({ storePath, backup: null });
  assert.deepEqual((await store.list('results')).map((item) => item.id).sort(), ['42', 'reference-training-07']);
  const onDisk = JSON.parse(await fs.readFile(storePath, 'utf8'));
  assert.ok(onDisk.migrations.includes('remove-placeholder-results-2026-11'));

  // Runs once: an id like the old stock ones added later is left alone.
  onDisk.collections.results.push(stock('reference-competition-02'));
  await fs.writeFile(storePath, JSON.stringify(onDisk));
  const reloaded = createCmsStore({ storePath, backup: null });
  assert.equal((await reloaded.list('results')).length, 3);
});

test('results saved before audience existed get it from their category on load', async () => {
  const { storePath } = await tempStore();
  const legacy = (category) => ({ caption: 'c', alt: 'a', category, kind: 'client', featured: false, image: { assetId: null, src: '/x.webp' }, presentation: null, tags: [], stats: [] });
  const record = (id, category, published) => ({ id, order: Number(id), draft: legacy(category), published: published ? legacy(category) : null, rev: 1 });
  await fs.writeFile(storePath, JSON.stringify({ schemaVersion: 2, collections: { results: [record('1', 'posing', true), record('2', 'training', false)] }, media: [] }));
  const store = createCmsStore({ storePath, backup: null });
  const [posing, training] = [await store.get('results', '1'), await store.get('results', '2')];
  assert.equal(posing.draft.audience, 'competitor');
  assert.equal(posing.published.audience, 'competitor');
  assert.equal(training.draft.audience, 'everyday');
  assert.equal(training.published, null);
  const onDisk = JSON.parse(await fs.readFile(storePath, 'utf8'));
  assert.equal(onDisk.collections.results[0].published.audience, 'competitor');
});

test('a chosen audience is kept and an unknown one falls back to the category', async () => {
  const { store } = await tempStore();
  const record = await store.get('results', '1');
  const saved = await store.saveDraft('results', '1', { draft: { ...record.draft, audience: 'transformation' }, rev: record.rev }, 'jake@example.com');
  assert.equal(saved.draft.audience, 'transformation');
  const again = await store.saveDraft('results', '1', { draft: { ...saved.draft, category: 'lifestyle', audience: 'nonsense' }, rev: saved.rev }, 'jake@example.com');
  assert.equal(again.draft.audience, 'everyday');
});

test('an existing store is never re-seeded, but a missing collection is', async () => {
  const { storePath } = await tempStore();
  await fs.writeFile(storePath, JSON.stringify({ schemaVersion: 2, collections: { results: [] }, media: [] }));
  const store = createCmsStore({ storePath, backup: null });
  assert.equal((await store.list('results')).length, 0);
  assert.ok((await store.list('faqs')).length > 0);
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

test('unpublished changes leave out offline items, so publishing them all never puts one live', async () => {
  const { store } = await tempStore();
  await store.create('results', { caption: 'Still offline' }, 'jake@example.com');
  const hidden = await store.get('results', '3');
  await store.saveDraft('results', hidden.id, { draft: { ...hidden.draft, caption: 'Edited while offline' }, rev: hidden.rev });
  assert.deepEqual(await store.pending(), []);

  await store.saveDraft('placements', 'about.portrait', { draft: { assetId: null, alt: 'Jake' }, rev: 0 }, 'jake', { label: 'Main portrait', page: 'About' });
  assert.deepEqual((await store.pending()).map((item) => [item.collection, item.id]), [['placements', 'about.portrait']]);
  await assert.rejects(store.apply('placements', 'about.portrait', 'unpublish'), { statusCode: 405 });
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

test('a testimonial is part of its result: it goes live with it, and must be complete', async () => {
  const { store } = await tempStore();
  const record = await store.get('results', '2');
  const saved = await store.saveDraft('results', '2', { draft: { ...record.draft, testimonial: { quote: '', author: 'Sam' } }, rev: record.rev });
  await assert.rejects(store.apply('results', '2', 'publish'), (error) => {
    assert.deepEqual(Object.keys(error.fields), ['testimonial.quote']);
    return true;
  });
  await store.saveDraft('results', '2', { draft: { ...record.draft, testimonial: null }, rev: saved.rev });
  await store.apply('results', '2', 'publish');
  assert.equal((await store.getPublic('results')).find((item) => item.id === '2').testimonial, undefined);
});

test('a store from before keeps each linked testimonial inside its result', async () => {
  const { storePath } = await tempStore();
  const version = (testimonialId) => ({ caption: 'Stage', alt: 'On stage', image: { src: 'https://x/a.webp' }, testimonialId });
  const record = (id, draft, published) => ({ id, order: 1, draft, published, rev: 1, hiddenAt: null });
  await fs.writeFile(storePath, JSON.stringify({
    schemaVersion: 1,
    media: [],
    collections: {
      results: [
        record('1', version('t-1'), version('t-1')),
        record('2', version('t-2'), version(null))
      ],
      testimonials: [
        record('t-1', { quote: 'Live words', author: 'Sam' }, { quote: 'Live words', author: 'Sam' }),
        record('t-2', { quote: 'Draft words', author: 'Ali' }, null),
        record('legacy-1', { quote: 'Never shown', author: 'Client' }, null)
      ]
    }
  }));
  const store = createCmsStore({ storePath, backup: null });
  const [first, second] = [await store.get('results', '1'), await store.get('results', '2')];
  assert.equal(first.published.testimonial.quote, 'Live words');
  assert.equal(first.status, 'published');
  assert.equal(second.draft.testimonial.quote, 'Draft words');
  assert.equal(second.published.testimonial, null);
  assert.equal(second.draft.testimonialId, undefined);

  const onDisk = JSON.parse(await fs.readFile(storePath, 'utf8'));
  assert.equal(onDisk.schemaVersion, 2);
  assert.equal(onDisk.collections.testimonials, undefined);
});

test('photo spots and results keep where a photo is framed, within limits', async () => {
  const { store } = await tempStore();
  const record = await store.get('results', '1');
  const saved = await store.saveDraft('results', '1', {
    draft: { ...record.draft, presentation: { fit: 'cover', focus: { x: 140, y: 20 }, zoom: 7 } }, rev: record.rev
  });
  assert.deepEqual(saved.draft.presentation, { fit: 'cover', focus: { x: 100, y: 20 }, zoom: 3 });
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
  assert.equal((await store.list('results')).length, 4);
});

test('preview shows the public list as if the draft were live, without saving it', async () => {
  const { store } = await tempStore();
  const record = await store.get('results', '2');
  const preview = await store.preview('results', '2', { ...record.draft, caption: 'Preview caption' });
  assert.equal(preview.results.find((item) => item.id === '2').caption, 'Preview caption');
  assert.notEqual((await store.get('results', '2')).draft.caption, 'Preview caption');

  const hidden = await store.preview('results', '3', (await store.get('results', '3')).draft);
  assert.ok(hidden.results.some((item) => item.id === '3'));

  const quote = await store.preview('results', '2', { ...record.draft, testimonial: { quote: 'New words', author: 'Sam' } });
  assert.equal(quote.results.find((item) => item.id === '2').testimonial.quote, 'New words');

  const fresh = await store.preview('results', null, { caption: 'Brand new', alt: 'x', image: { src: 'https://x/y.webp' } });
  assert.equal(fresh.results[0].caption, 'Brand new');
});

test('concurrent writes are serialised and all land', async () => {
  const { store, storePath } = await tempStore();
  await Promise.all(Array.from({ length: 10 }, (_, index) => store.create('results', { caption: `Result ${index}` })));
  const fresh = createCmsStore({ storePath, backup: null });
  assert.equal((await fresh.list('results')).length, 16);
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
