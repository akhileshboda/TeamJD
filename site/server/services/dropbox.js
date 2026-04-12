const { normalizeDropboxUrl } = require('../utils/url');

const DEFAULT_ASSET_MAP = {
  ab_posing:
    'https://www.dropbox.com/scl/fi/hma3vqxbhdtwqvgug8cq7/ab-posing.jpg?rlkey=b2cdcaibl5b6u83jc9ji8y344&st=snwbqvra&dl=0'
};

function getConfiguredAssetMap() {
  const rawAssetMap = process.env.DROPBOX_ASSET_MAP;

  if (!rawAssetMap) {
    return DEFAULT_ASSET_MAP;
  }

  try {
    const parsedAssetMap = JSON.parse(rawAssetMap);
    return {
      ...DEFAULT_ASSET_MAP,
      ...parsedAssetMap
    };
  } catch (error) {
    throw new Error('DROPBOX_ASSET_MAP must be valid JSON.');
  }
}

function getAssetUrl(assetKey) {
  const assetMap = getConfiguredAssetMap();
  const sharedUrl = assetMap[assetKey];

  if (!sharedUrl) {
    return null;
  }

  return normalizeDropboxUrl(sharedUrl);
}

module.exports = {
  getAssetUrl
};
