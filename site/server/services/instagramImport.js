const crypto = require('crypto');
const path = require('path');
const { SEED_DIR, normalizeResult, seedRecord } = require('./cmsCollections');
const { cmsPrefixIsSafe, getCmsPrefix } = require('./mediaIngest');
const { copyR2Object, getPublicR2Url, isR2Configured } = require('./r2');

// One-off imports of the photos taken from Jake's Instagram
// (site/docs/media-provenance.md), in batches. They sit in R2 under imports/, shared by
// every environment. On the first start with R2 configured, each environment
// copies them into its own media library (cms/<environment>/), so deleting a
// library photo never removes the shared original, and creates the results
// named in the batch. A marker per batch in the store stops it running twice.
// Nothing is saved until every photo is copied, and each copy has a fixed key
// per environment, so a run cut short is simply repeated: it overwrites its own
// earlier copies rather than leaving strays behind.

function readImport(seedDir = SEED_DIR) {
  return require(path.join(seedDir, 'instagram-import.json'));
}

function defaultStorage() {
  return {
    configured: () => isR2Configured() && cmsPrefixIsSafe(),
    copy: copyR2Object,
    publicUrl: getPublicR2Url,
    prefix: getCmsPrefix
  };
}

async function runInstagramImport(store, {
  plan = readImport(),
  storage = defaultStorage(),
  now = () => new Date().toISOString()
} = {}) {
  const outcomes = [];
  for (const batch of plan.batches) {
    outcomes.push({ batch: batch.id, ...await importBatch(store, batch, { storage, now }) });
  }
  const imported = outcomes.filter((outcome) => outcome.status === 'imported');
  if (imported.length) return { status: 'imported', batches: imported };
  return { status: outcomes.every((outcome) => outcome.status === 'done-before') ? 'done-before' : 'skipped', batches: outcomes };
}

async function importBatch(store, plan, { storage, now }) {
  const state = await store.read((data) => ({
    done: (data.migrations || []).includes(plan.id),
    sources: new Set(data.media.map((asset) => asset.source).filter(Boolean))
  }));
  if (state.done) return { status: 'done-before' };
  if (!storage.configured()) return { status: 'skipped', reason: 'R2 is not configured' };

  const prefix = storage.prefix();
  const copied = [];
  // One at a time: a handful of small server-side copies, no need to hurry.
  for (const photo of plan.photos) {
    const source = `${plan.sourcePrefix}/${photo.key}`;
    if (state.sources.has(source)) continue;
    const id = crypto.randomUUID();
    const objectKey = `${prefix}/instagram-${photo.key}`;
    await storage.copy({ sourceKey: source, objectKey, contentType: 'image/webp' });
    copied.push({
      id,
      kind: 'image',
      url: storage.publicUrl(objectKey),
      posterUrl: null,
      width: photo.width,
      height: photo.height,
      bytes: photo.bytes,
      originalBytes: photo.bytes,
      r2Keys: [objectKey],
      backup: 'skipped',
      originalName: photo.key,
      alt: photo.alt || '',
      uploadedAt: now(),
      uploadedBy: 'Instagram import',
      source
    });
  }

  return store.mutate((data, timestamp) => {
    data.migrations ??= [];
    if (data.migrations.includes(plan.id)) return { status: 'done-before' };

    const known = new Set(data.media.map((asset) => asset.source).filter(Boolean));
    for (const asset of copied) if (!known.has(asset.source)) data.media.push(asset);
    const bySource = new Map(data.media.filter((asset) => asset.source).map((asset) => [asset.source, asset]));

    // The Instagram results open the library, ahead of the older stage photos.
    const results = data.collections.results;
    const firstOrder = Math.min(1, ...results.map((record) => record.order));
    const existing = new Set(results.map((record) => record.id));
    let created = 0;
    plan.results.forEach((item, index) => {
      const asset = bySource.get(`${plan.sourcePrefix}/${item.key}`);
      if (!asset || existing.has(item.id)) return;
      const { id, key, ...fields } = item;
      const draft = normalizeResult({ ...fields, kind: 'client', image: { assetId: asset.id, src: asset.url } });
      const record = seedRecord({ id, order: firstOrder - plan.results.length + index, draft, live: true, now: timestamp });
      record.updatedBy = 'Instagram import';
      results.push(record);
      created += 1;
    });

    data.migrations.push(plan.id);
    return { status: 'imported', photos: copied.length, results: created };
  });
}

module.exports = { readImport, runInstagramImport };
