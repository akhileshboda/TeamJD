const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createCmsStore } = require('./cmsStore');

const ORIGINAL_SERVICES = require('../seed/services.json');
const ORIGINAL_FAQS = require('../seed/faqs.json');

async function tempStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cms-services-'));
  return createCmsStore({ storePath: path.join(dir, 'cms.json'), backup: null });
}

test('the public services are byte-for-byte the old services.json', async () => {
  const store = await tempStore();
  assert.equal(JSON.stringify(await store.getPublic('services')), JSON.stringify(ORIGINAL_SERVICES));
});

test('the public FAQs keep their questions and answers, in order', async () => {
  const store = await tempStore();
  assert.deepEqual(await store.getPublic('faqs'), ORIGINAL_FAQS.map((faq) => ({ ...faq, id: String(faq.id) })));
});

test('edits change the words and prices but never the locked fields', async () => {
  const store = await tempStore();
  const record = await store.get('services', 'personal-training');
  const draft = structuredClone(record.draft);
  draft.name = 'Personal Training 1:1';
  draft.slug = 'hacked';
  draft.theme = { accent: '#000000' };
  draft.hero_image = 'some-other-key';
  draft.pricing.tiers[0].price = '$90';
  draft.includes[0].icon = 'icons/evil.png';
  draft.includes[0].title = 'New include title';
  draft.venue.images[0].asset = 'other';
  draft.venue.images[0].alt = 'New venue description';

  const saved = await store.saveDraft('services', 'personal-training', { draft, rev: record.rev });
  assert.equal(saved.draft.name, 'Personal Training 1:1');
  assert.equal(saved.draft.slug, 'personal-training');
  assert.deepEqual(saved.draft.theme, ORIGINAL_SERVICES[2].theme);
  assert.equal(saved.draft.hero_image, ORIGINAL_SERVICES[2].hero_image);
  assert.equal(saved.draft.pricing.tiers[0].price, '$90');
  assert.equal(saved.draft.includes[0].icon, ORIGINAL_SERVICES[2].includes[0].icon);
  assert.equal(saved.draft.includes[0].title, 'New include title');
  assert.equal(saved.draft.venue.images[0].asset, ORIGINAL_SERVICES[2].venue.images[0].asset);
  assert.equal(saved.draft.venue.images[0].alt, 'New venue description');
  assert.deepEqual(Object.keys(saved.draft), Object.keys(ORIGINAL_SERVICES[2]));

  await store.apply('services', 'personal-training', 'publish');
  const live = (await store.getPublic('services')).find((service) => service.id === 'personal-training');
  assert.equal(live.pricing.tiers[0].price, '$90');
});

test('services cannot be added, deleted or hidden', async () => {
  const store = await tempStore();
  await assert.rejects(store.create('services', {}), { statusCode: 405 });
  await assert.rejects(store.apply('services', 'posing-only', 'delete'), { statusCode: 405 });
  await assert.rejects(store.apply('services', 'posing-only', 'unpublish'), { statusCode: 405 });
});

test('a service needs a real booking link and a price before it can go live', async () => {
  const store = await tempStore();
  const record = await store.get('services', 'posing-only');
  const draft = { ...record.draft, cta_url: 'calendly', pricing: { mode: 'priced', tiers: [], note: null } };
  draft.facts = [{ label: 'Where', value: 'Studio', url: 'not a link' }];
  await store.saveDraft('services', 'posing-only', { draft, rev: record.rev });
  await assert.rejects(store.apply('services', 'posing-only', 'publish'), (error) => {
    assert.equal(error.statusCode, 422);
    assert.deepEqual(Object.keys(error.fields).sort(), ['cta_url', 'facts.0.url', 'pricing']);
    return true;
  });
});

test('FAQs can be added, reordered and published', async () => {
  const store = await tempStore();
  const created = await store.create('faqs', { question: 'Do you coach online?', answer: 'Yes, anywhere in Australia.' });
  await store.apply('faqs', created.id, 'publish');
  const faqs = await store.getPublic('faqs');
  assert.equal(faqs[0].question, 'Do you coach online?');
  assert.equal(faqs.length, ORIGINAL_FAQS.length + 1);
});
