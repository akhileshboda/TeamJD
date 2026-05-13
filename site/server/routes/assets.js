const express = require('express');
const {
  discoverDropboxAssets,
  getAssetMap,
  getAssetServiceStatus,
  getAssetUrl,
  refreshAssetMap
} = require('../services/dropbox');

const router = express.Router();

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
    const assets = await getAssetMap({
      authState: getSessionAuthState(req)
    });

    return res.json({ assets });
  } catch (error) {
    console.error('GET /api/assets error:', error);
    return res.status(500).json({ error: 'Failed to load assets.' });
  }
});

router.get('/refresh', async (req, res) => {
  try {
    const assets = await refreshAssetMap({
      authState: getSessionAuthState(req)
    });

    return res.json({ assets, refreshed: true });
  } catch (error) {
    console.error('GET /api/assets/refresh error:', error);
    return res.status(500).json({ error: 'Failed to refresh assets.' });
  }
});

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
    const assetUrl = await getAssetUrl(req.params.assetKey, {
      authState: getSessionAuthState(req)
    });

    if (!assetUrl) {
      return res.status(404).json({ error: 'Asset not found.' });
    }

    return res.redirect(assetUrl);
  } catch (error) {
    console.error(`GET /api/assets/${req.params.assetKey} error:`, error);
    return res.status(500).json({ error: 'Failed to resolve asset.' });
  }
});

module.exports = router;
