const express = require('express');
const { publicAssetLimiter } = require('../middleware/rateLimits');
const { getCmsStore } = require('../services/cmsStore');

// GET /api/content/:collection — published dashboard content for the public
// site, in the shapes its components already read.
function createContentRouter({ store = getCmsStore() } = {}) {
  const router = express.Router();

  router.get('/:collection', publicAssetLimiter, async (req, res) => {
    res.set('Cache-Control', 'no-cache, max-age=0, must-revalidate');
    try {
      return res.json(await store.getPublic(req.params.collection));
    } catch (error) {
      if (error.statusCode === 404) return res.status(404).json({ error: 'Not found.' });
      console.error(`GET /api/content/${req.params.collection} error:`, error);
      return res.status(500).json({ error: 'Content is unavailable right now.' });
    }
  });

  return router;
}

module.exports = { createContentRouter };
