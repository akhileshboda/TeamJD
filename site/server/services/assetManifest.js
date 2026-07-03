const fs = require('fs/promises');
const path = require('path');
const { CATEGORIES } = require('./assetClassifier');

const MANIFEST_PATH = path.join(__dirname, '..', '..', 'data', 'asset-manifest.json');

function createEmptyByCategory() {
  return CATEGORIES.reduce((acc, category) => {
    acc[category] = [];
    return acc;
  }, {});
}

function normalizeManifest(rawManifest = {}, fallbackSource = 'disk') {
  const assets = rawManifest.assets && typeof rawManifest.assets === 'object' ? rawManifest.assets : {};
  const byCategory = createEmptyByCategory();

  for (const [assetKey, asset] of Object.entries(assets)) {
    const category = asset.category || 'misc';
    if (!byCategory[category]) byCategory[category] = [];
    byCategory[category].push(assetKey);
  }

  for (const [category, keys] of Object.entries(rawManifest.byCategory || {})) {
    if (!byCategory[category]) byCategory[category] = [];
    for (const key of keys || []) {
      if (!byCategory[category].includes(key)) {
        byCategory[category].push(key);
      }
    }
  }

  return {
    generatedAt: rawManifest.generatedAt || new Date().toISOString(),
    source: rawManifest.source || fallbackSource,
    assetCount: Object.keys(assets).length,
    assets,
    byCategory
  };
}

function createAssetManifest(assetMap, source = 'dropbox-latest-to-r2', generatedAt = new Date().toISOString()) {
  return normalizeManifest(
    {
      generatedAt,
      source,
      assets: assetMap
    },
    source
  );
}

async function readDiskManifest(options = {}) {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
    return normalizeManifest(JSON.parse(raw), 'disk');
  } catch (error) {
    if (options.allowMissing && error.code === 'ENOENT') {
      return createAssetManifest({}, 'empty');
    }
    throw error;
  }
}

async function writeDiskManifest(manifest) {
  const normalized = normalizeManifest(manifest, manifest.source || 'dropbox-latest-to-r2');
  const tmpPath = `${MANIFEST_PATH}.tmp`;
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await fs.writeFile(tmpPath, `${JSON.stringify(normalized, null, 2)}\n`);
  await fs.rename(tmpPath, MANIFEST_PATH);
  return normalized;
}

module.exports = {
  MANIFEST_PATH,
  createAssetManifest,
  createEmptyByCategory,
  normalizeManifest,
  readDiskManifest,
  writeDiskManifest
};
