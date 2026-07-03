const {
  SUPPORTED_ASSET_TYPES,
  classifyAsset,
  createAssetVersion,
  createR2ObjectKey,
  getAssetKey,
  getContentType,
  getExtension,
  getSafeFileName,
  isPathInside,
  isSupportedAsset,
  joinDropboxPath,
  normalizeDropboxPath
} = require('./assetClassifier');

const IMAGE_EXTENSIONS = new Set(Object.keys(SUPPORTED_ASSET_TYPES));
const IMAGE_CONTENT_TYPES = SUPPORTED_ASSET_TYPES;

function createAssetKey(fileName) {
  return getAssetKey(fileName);
}

function isImageFile(entry) {
  return entry?.['.tag'] === 'file' && isSupportedAsset(entry.name);
}

function sortDropboxAssetFiles(files) {
  return [...files].sort((a, b) => {
    const aPath = a.path_lower || a.path_display || a.name || '';
    const bPath = b.path_lower || b.path_display || b.name || '';
    return aPath.localeCompare(bPath);
  });
}

function getUniqueAssetKey(assetMap, preferredKey) {
  const baseKey = preferredKey || 'asset';
  let assetKey = baseKey;
  let suffix = 2;

  while (assetMap[assetKey]) {
    assetKey = `${baseKey}-${suffix}`;
    suffix += 1;
  }

  return assetKey;
}

function getOrganizationForAsset(assetKey) {
  const category = classifyAsset({ fileName: assetKey });
  return { folder: category, public: true, category };
}

function getDropboxOrganizedPath(file, rootPath = process.env.DROPBOX_ASSETS_ROOT || '/assets') {
  const category = classifyAsset({
    fileName: file.name,
    dropboxPath: file.path_display || file.path_lower || ''
  });
  return joinDropboxPath(rootPath, category, getSafeFileName(file.name));
}

function shouldIncludeInManifest(file) {
  return isSupportedAsset(file.name);
}

function getImageContentType(extension) {
  return getContentType(extension);
}

module.exports = {
  IMAGE_CONTENT_TYPES,
  IMAGE_EXTENSIONS,
  createAssetKey,
  createAssetVersion,
  createR2ObjectKey,
  getDropboxOrganizedPath,
  getImageContentType,
  getOrganizationForAsset,
  getUniqueAssetKey,
  isImageFile,
  isPathInside,
  joinDropboxPath,
  normalizeDropboxPath,
  shouldIncludeInManifest,
  sortDropboxAssetFiles
};
