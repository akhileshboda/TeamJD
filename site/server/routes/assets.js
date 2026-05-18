const express = require('express');
const {
  AssetNotFoundError,
  AssetMapNotReadyError,
  discoverDropboxAssets,
  getAssetManifest,
  getAssetMap,
  getAssetServiceStatus,
  getAssetUrl,
  isProductionAssetMode,
  streamDropboxAsset,
  refreshAssetMap
} = require('../services/dropbox');

const router = express.Router();
const ASSET_REDIRECT_CACHE_SECONDS = 60 * 60;

function sendAssetError(res, error, fallbackMessage) {
  if (error instanceof AssetNotFoundError) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  if (error instanceof AssetMapNotReadyError) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  return res.status(500).json({ error: fallbackMessage });
}

function getSessionAuthState(req) {
  if (!req.session?.dropbox) {
    return undefined;
  }

  return {
    accessToken: req.session.dropbox.accessToken,
    refreshToken: req.session.dropbox.refreshToken
  };
}

router.get('/', async (req, res) => {
  try {
    const assets = await getAssetMap();

    return res.json({ assets });
  } catch (error) {
    console.error('GET /api/assets error:', error);
    return sendAssetError(res, error, 'Failed to load assets.');
  }
});

router.get('/manifest', async (req, res) => {
  try {
    const manifest = await getAssetManifest();

    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.json(manifest);
  } catch (error) {
    console.error('GET /api/assets/manifest error:', error);
    return sendAssetError(res, error, 'Failed to load asset manifest.');
  }
});

async function handleRefreshAssetMap(req, res) {
  try {
    await refreshAssetMap();
    const manifest = await getAssetManifest();

    return res.json({ ...manifest, refreshed: true });
  } catch (error) {
    console.error(`${req.method} /api/assets/refresh error:`, error);
    try {
      const currentManifest = await getAssetManifest();
      return res.status(500).json({ error: 'Failed to refresh assets.', currentManifest });
    } catch (_) {
      return res.status(500).json({ error: 'Failed to refresh assets.' });
    }
  }
}

router.get('/refresh', handleRefreshAssetMap);
router.post('/refresh', handleRefreshAssetMap);

router.get('/status', (req, res) => {
  return res.json(getAssetServiceStatus());
});

router.get('/discover', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found.' });
  }

  try {
    const discovery = await discoverDropboxAssets({
      authState: getSessionAuthState(req),
      folderPath: typeof req.query.path === 'string' ? req.query.path : undefined
    });

    return res.json(discovery);
  } catch (error) {
    console.error('GET /api/assets/discover error:', error);
    return res.status(500).json({ error: 'Failed to discover Dropbox assets.' });
  }
});

router.get('/:assetKey', async (req, res) => {
  try {
    if (!isProductionAssetMode()) {
      return await streamDropboxAsset(req.params.assetKey, res);
    }

    const assetUrl = await getAssetUrl(req.params.assetKey);

    if (!assetUrl) {
      return res.status(404).json({ error: 'Asset not found.' });
    }

    res.set(
      'Cache-Control',
      `public, max-age=${ASSET_REDIRECT_CACHE_SECONDS}, stale-while-revalidate=86400`
    );

    return res.redirect(assetUrl);
  } catch (error) {
    console.error(`GET /api/assets/${req.params.assetKey} error:`, error);
    return sendAssetError(res, error, 'Failed to resolve asset.');
  }
});

module.exports = router;
