const express = require('express');
const {
  AssetNotFoundError,
  AssetMapNotReadyError,
  discoverDropboxAssets,
  getAssetManifest,
  getAssetMap,
  getAssetServiceStatus,
  getAssetUrl,
  getSetupStatus,
  isR2AssetMode,
  isProductionAssetMode,
  planAssetSync,
  runManualAssetSync,
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

function requireSyncAdmin(req, res, next) {
  const expectedToken = process.env.ASSET_SYNC_ADMIN_TOKEN;
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';

  if (!expectedToken) {
    return res.status(503).json({ error: 'Asset sync admin token is not configured.' });
  }

  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token.' });
  }

  if (token !== expectedToken) {
    return res.status(403).json({ error: 'Invalid bearer token.' });
  }

  return next();
}

router.get('/', async (req, res) => {
  try {
    const manifest = await getAssetManifest();

    res.set('Cache-Control', 'no-cache, max-age=0, must-revalidate');
    return res.json(manifest);
  } catch (error) {
    console.error('GET /api/assets error:', error);
    res.set('Cache-Control', 'no-cache, max-age=0, must-revalidate');
    return res.json({
      generatedAt: null,
      source: 'empty',
      assetCount: 0,
      assets: {},
      byCategory: {}
    });
  }
});

router.get('/manifest', async (req, res) => {
  try {
    const manifest = await getAssetManifest();

    res.set('Cache-Control', 'no-cache, max-age=0, must-revalidate');
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
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Failed to refresh assets.',
        code: error.code || 'ASSET_REFRESH_FAILED',
        details: error.details || null,
        currentManifest
      });
    } catch (_) {
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Failed to refresh assets.',
        code: error.code || 'ASSET_REFRESH_FAILED',
        details: error.details || null
      });
    }
  }
}

router.get('/refresh', requireSyncAdmin, handleRefreshAssetMap);
router.post('/refresh', requireSyncAdmin, handleRefreshAssetMap);

router.get('/status', (req, res) => {
  return res.json(getAssetServiceStatus());
});

router.get('/setup-status', requireSyncAdmin, async (req, res) => {
  try {
    const manifest = await getAssetManifest().catch(() => null);
    return res.json(getSetupStatus(manifest));
  } catch (error) {
    console.error('GET /api/assets/setup-status error:', error);
    return res.status(500).json({ error: 'Failed to load setup status.' });
  }
});

router.get('/sync/plan', requireSyncAdmin, async (req, res) => {
  try {
    const plan = await planAssetSync({ record: true, source: 'api' });
    return res.status(plan.ok ? 200 : 400).json(plan);
  } catch (error) {
    console.error('GET /api/assets/sync/plan error:', error);
    return res.status(500).json({ error: 'Failed to build asset sync plan.' });
  }
});

router.post('/sync', requireSyncAdmin, async (req, res) => {
  try {
    const { report } = await runManualAssetSync();
    return res.status(report.ok ? 200 : 207).json(report);
  } catch (error) {
    console.error('POST /api/assets/sync error:', error);
    return res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to run asset sync.',
      code: error.code || 'ASSET_SYNC_FAILED',
      details: error.details || null
    });
  }
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
    if (!isProductionAssetMode() && !isR2AssetMode()) {
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
module.exports.requireSyncAdmin = requireSyncAdmin;
