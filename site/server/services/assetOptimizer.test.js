const assert = require('node:assert/strict');
const test = require('node:test');
const sharp = require('sharp');
const {
  getOptimizedAssetInfo,
  getOptimizedAssetVersion,
  optimizeAssetBuffer
} = require('./assetOptimizer');

test('converts raster image buffers to optimized WebP output metadata', async () => {
  const pngBuffer = await sharp({
    create: {
      width: 64,
      height: 48,
      channels: 4,
      background: { r: 180, g: 40, b: 80, alpha: 1 }
    }
  })
    .png()
    .toBuffer();

  const result = await optimizeAssetBuffer({
    buffer: pngBuffer,
    fileName: 'hero-photo.png'
  });

  assert.equal(result.optimized, true);
  assert.equal(result.fileName, 'hero-photo.webp');
  assert.equal(result.contentType, 'image/webp');
  assert.equal(result.originalContentType, 'image/png');
  assert.equal(result.originalSize, pngBuffer.length);
  assert.equal(result.optimizedSize, result.buffer.length);

  const metadata = await sharp(result.buffer).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 64);
  assert.equal(metadata.height, 48);
});

test('passes through non-raster assets without changing names or content type', async () => {
  const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  const result = await optimizeAssetBuffer({
    buffer: svgBuffer,
    fileName: 'brand-mark.svg'
  });

  assert.equal(result.optimized, false);
  assert.equal(result.fileName, 'brand-mark.svg');
  assert.equal(result.contentType, 'image/svg+xml');
  assert.equal(result.buffer, svgBuffer);
  assert.equal(result.optimizedSize, svgBuffer.length);
});

test('adds optimizer version to raster asset versions only', () => {
  const rasterInfo = getOptimizedAssetInfo('hero.jpg');
  const svgInfo = getOptimizedAssetInfo('logo.svg');

  assert.match(getOptimizedAssetVersion('rev-a:hash-a', rasterInfo), /asset-optimizer-v1:webp:q82:w2400/);
  assert.equal(getOptimizedAssetVersion('rev-a:hash-a', svgInfo), 'rev-a:hash-a');
});
