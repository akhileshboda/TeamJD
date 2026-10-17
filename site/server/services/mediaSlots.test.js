const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
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

test('slot ids are unique and every slot knows its page for previews', async () => {
  const definitions = await slots.listSlotDefinitions();
  assert.equal(new Set(definitions.map((slot) => slot.id)).size, definitions.length);
  for (const slot of definitions) {
    assert.ok(CATEGORIES.includes(slot.category), `${slot.id} category ${slot.category}`);
    assert.ok(['image', 'video'].includes(slot.kind), slot.id);
    assert.match(slot.pagePath, /^\/(about|contact|services\/[a-z-]+)?$/, slot.id);
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
