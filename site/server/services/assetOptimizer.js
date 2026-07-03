const path = require('path');
const sharp = require('sharp');
const { getContentType, getExtension } = require('./assetClassifier');

const OPTIMIZER_VERSION = 'asset-optimizer-v1';
const RASTER_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const WEBP_CONTENT_TYPE = 'image/webp';

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getAssetOptimizerConfig(env = process.env) {
  const format = String(env.ASSET_OPTIMIZER_FORMAT || 'webp').toLowerCase();

  return {
    enabled: env.ASSET_OPTIMIZE_IMAGES !== 'false',
    format: format === 'webp' ? 'webp' : 'webp',
    quality: Math.min(100, Math.max(1, parsePositiveInteger(env.ASSET_OPTIMIZER_QUALITY, 82))),
    maxWidth: parsePositiveInteger(env.ASSET_OPTIMIZER_MAX_WIDTH, 2400)
  };
}

function isRasterImage(fileName = '') {
  return RASTER_IMAGE_EXTENSIONS.has(getExtension(fileName));
}

function replaceExtension(fileName, extension) {
  return `${path.basename(fileName, path.extname(fileName))}${extension}`;
}

function getOptimizerVersion(config = getAssetOptimizerConfig()) {
  return `${OPTIMIZER_VERSION}:${config.format}:q${config.quality}:w${config.maxWidth}`;
}

function getOptimizedAssetInfo(fileName, options = {}) {
  const config = options.config || getAssetOptimizerConfig();
  const originalName = fileName;
  const originalContentType = getContentType(fileName);
  const shouldOptimize = Boolean(config.enabled && isRasterImage(fileName));
  const optimizedName = shouldOptimize ? replaceExtension(fileName, '.webp') : fileName;
  const contentType = shouldOptimize ? WEBP_CONTENT_TYPE : originalContentType;

  return {
    optimized: shouldOptimize,
    originalName,
    originalContentType,
    originalSize: options.originalSize ?? null,
    optimizedSize: null,
    fileName: optimizedName,
    extension: getExtension(optimizedName),
    contentType,
    optimizerVersion: shouldOptimize ? getOptimizerVersion(config) : null
  };
}

function getOptimizedAssetVersion(assetVersion, transferInfo) {
  if (!transferInfo?.optimized || !transferInfo.optimizerVersion) {
    return assetVersion || null;
  }

  return [assetVersion, transferInfo.optimizerVersion]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .map(String)
    .join(':');
}

async function optimizeAssetBuffer({ buffer, fileName, config = getAssetOptimizerConfig() }) {
  const transferInfo = getOptimizedAssetInfo(fileName, {
    config,
    originalSize: buffer?.length ?? null
  });

  if (!transferInfo.optimized) {
    return {
      ...transferInfo,
      buffer,
      optimizedSize: buffer?.length ?? null
    };
  }

  const optimizedBuffer = await sharp(buffer)
    .rotate()
    .resize({
      width: config.maxWidth,
      withoutEnlargement: true
    })
    .webp({
      quality: config.quality
    })
    .toBuffer();

  return {
    ...transferInfo,
    buffer: optimizedBuffer,
    optimizedSize: optimizedBuffer.length
  };
}

module.exports = {
  getAssetOptimizerConfig,
  getOptimizedAssetInfo,
  getOptimizedAssetVersion,
  getOptimizerVersion,
  isRasterImage,
  optimizeAssetBuffer
};
