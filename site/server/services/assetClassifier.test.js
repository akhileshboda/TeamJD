const assert = require('node:assert/strict');
const test = require('node:test');
const {
  classifyAsset,
  createR2ObjectKey,
  getAssetKey,
  getContentType,
  getSafeFileName,
  isSupportedAsset,
  normalizeAssetFileName
} = require('./assetClassifier');
const { createAssetManifest } = require('./assetManifest');
const { createPlanFingerprint } = require('./assetSync');

test('validates supported asset extensions and MIME types', () => {
  assert.equal(isSupportedAsset('photo.JPG'), true);
  assert.equal(isSupportedAsset('logo.svg'), true);
  assert.equal(isSupportedAsset('hero-home-loop-v1.webm'), true);
  assert.equal(isSupportedAsset('.env'), false);
  assert.equal(getContentType('hero-home-loop-v1.webm'), 'video/webm');
  assert.equal(getContentType('logo.svg'), 'image/svg+xml');
});

test('normalizes filenames and asset keys safely', () => {
  assert.equal(normalizeAssetFileName('Home Hero Jake Final.JPG'), 'home-hero-jake-final.jpg');
  assert.equal(normalizeAssetFileName('logo white transparent.SVG'), 'logo-white-transparent.svg');
  assert.equal(getAssetKey('client transformation before after.png'), 'client-transformation-before-after');
});

test('classifies assets into site categories deterministically', () => {
  assert.equal(classifyAsset({ fileName: 'Home Hero Jake Final.JPG' }), 'home');
  assert.equal(classifyAsset({ fileName: 'client transformation before after.png' }), 'results');
  assert.equal(classifyAsset({ fileName: 'logo white transparent.svg' }), 'branding');
  assert.equal(classifyAsset({ fileName: 'hero-home-loop-v1.webm' }), 'video');
  assert.equal(classifyAsset({ fileName: 'unlabelled upload.jpg' }), 'misc');
});

test('creates collision-safe Dropbox destination filenames', () => {
  const reserved = new Set(['home-hero-jake-final.jpg', 'home-hero-jake-final-2.jpg']);
  assert.equal(getSafeFileName('Home Hero Jake Final.JPG', reserved), 'home-hero-jake-final-3.jpg');
});

test('creates R2 object keys under site-assets category prefixes', () => {
  assert.equal(
    createR2ObjectKey({
      assetPrefix: 'site-assets',
      category: 'home',
      fileName: 'home-hero-jake-final.jpg'
    }),
    'site-assets/home/home-hero-jake-final.jpg'
  );
});

test('creates manifests with byCategory indexes', () => {
  const manifest = createAssetManifest({
    'home-hero-jake-final': {
      category: 'home',
      url: 'https://assets.example/site-assets/home/home-hero-jake-final.jpg'
    },
    'logo-white-transparent': {
      category: 'branding',
      url: 'https://assets.example/site-assets/branding/logo-white-transparent.svg'
    }
  });

  assert.deepEqual(manifest.byCategory.home, ['home-hero-jake-final']);
  assert.deepEqual(manifest.byCategory.branding, ['logo-white-transparent']);
  assert.equal(manifest.assetCount, 2);
});

test('creates deterministic dry-run plan fingerprints', () => {
  const plan = {
    plan: [
      {
        source: '/latest/Home Hero Jake Final.JPG',
        rev: 'rev-a',
        contentHash: 'hash-a',
        dropboxDestination: '/assets/home/home-hero-jake-final.jpg',
        r2ObjectKey: 'site-assets/home/home-hero-jake-final.jpg',
        action: 'upload-to-r2-write-manifest-and-move-dropbox-file'
      }
    ],
    staleR2Deletes: [],
    skipped: []
  };

  assert.equal(createPlanFingerprint(plan), createPlanFingerprint(JSON.parse(JSON.stringify(plan))));
});
