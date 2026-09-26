const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { CATEGORIES } = require('./assetClassifier');
const slots = require('./mediaSlots');

const CLIENT_SRC = path.join(__dirname, '..', '..', 'client', 'src');

async function readClientSources(dir = CLIENT_SRC) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return readClientSources(full);
    return /\.jsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [await fs.readFile(full, 'utf8')] : [];
  }));
  return files.flat().join('\n');
}

async function tempStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'slots-'));
  slots.resetStoreCache();
  return { storePath: path.join(dir, 'media-slots.json') };
}

const version = (assetKey, extra = {}) => ({ assetKey, kind: 'image', url: `https://cdn/${assetKey}.webp`, alt: '', ...extra });

test('slot ids are unique and every slot has a valid storage category', async () => {
  const definitions = await slots.listSlotDefinitions();
  assert.equal(new Set(definitions.map((slot) => slot.id)).size, definitions.length);
  for (const slot of definitions) {
    assert.ok(CATEGORIES.includes(slot.category), `${slot.id} category ${slot.category}`);
    assert.ok(['image', 'video'].includes(slot.kind), slot.id);
  }
});

test('client code and the slot registry reference the same slots', async () => {
  const source = await readClientSources();
  const definitions = await slots.listSlotDefinitions();
  const ids = new Set(definitions.map((slot) => slot.id));

  // Every literal slot id the client asks for must exist, or Jake's upload would never show.
  const literals = [...source.matchAll(/['"`]((?:home|about|contact)\.[a-z0-9-]+)['"`]/g)].map((m) => m[1]);
  for (const id of literals) assert.ok(ids.has(id), `client uses unknown slot ${id}`);

  // Every fixed slot must be rendered somewhere, or Jake could edit a spot that changes nothing.
  for (const slot of definitions.filter((definition) => !definition.id.startsWith('services.'))) {
    const numbered = slot.id.match(/^(.*-)\d+$/);
    const used = source.includes(`'${slot.id}'`) || (numbered && source.includes(`\`${numbered[1]}\${`));
    assert.ok(used, `slot ${slot.id} is not rendered by the client`);
  }

  // Service slots are built from the service slug; each part must be requested by the client.
  for (const part of ['hero', 'body', 'banner', 'gallery-', 'venue-']) {
    assert.ok(source.includes(`.${part}`), `service slot part ${part} is not rendered`);
  }
});

test('replacing, restoring and resetting keep a bounded history', async () => {
  const options = await tempStore();
  for (let n = 1; n <= slots.HISTORY_LIMIT + 3; n += 1) {
    await slots.assignVersion('about.portrait', version(`v${n}`), options);
  }
  let entry = (await slots.readStore(options.storePath)).slots['about.portrait'];
  assert.equal(entry.current.assetKey, `v${slots.HISTORY_LIMIT + 3}`);
  assert.equal(entry.history.length, slots.HISTORY_LIMIT);

  entry = await slots.restoreVersion('about.portrait', 'v5', options);
  assert.equal(entry.current.assetKey, 'v5');
  assert.equal(entry.history[0].assetKey, `v${slots.HISTORY_LIMIT + 3}`);
  assert.ok(!entry.history.some((item) => item.assetKey === 'v5'));

  entry = await slots.resetSlot('about.portrait', options);
  assert.equal(entry.current, null);
  assert.equal(entry.history[0].assetKey, 'v5');
});

test('alt text needs an uploaded photo and only replaced slots are public', async () => {
  const options = await tempStore();
  await assert.rejects(slots.setAltText('about.portrait', 'Jake on stage', options), { statusCode: 409 });

  await slots.assignVersion('about.portrait', version('a'), options);
  await slots.setAltText('about.portrait', 'Jake on stage', options);
  await slots.assignVersion('home.about-photo', version('b'), options);
  await slots.resetSlot('home.about-photo', options);

  assert.deepEqual(await slots.getPublicSlots(options.storePath), {
    'about.portrait': { kind: 'image', url: 'https://cdn/a.webp', posterUrl: null, alt: 'Jake on stage' }
  });
});

test('concurrent edits are serialised rather than lost', async () => {
  const options = await tempStore();
  await Promise.all(['a', 'b', 'c', 'd'].map((key) => slots.assignVersion('about.portrait', version(key), options)));
  const entry = (await slots.readStore(options.storePath)).slots['about.portrait'];
  assert.equal(1 + entry.history.length, 4);
  slots.resetStoreCache();
  const onDisk = JSON.parse(await fs.readFile(options.storePath, 'utf8')).slots['about.portrait'];
  assert.equal(onDisk.current.assetKey, entry.current.assetKey);
});
