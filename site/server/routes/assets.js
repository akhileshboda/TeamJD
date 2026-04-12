const express = require('express');
const { getAssetUrl } = require('../services/dropbox');

const router = express.Router();

router.get('/:assetKey', (req, res) => {
  try {
    const assetUrl = getAssetUrl(req.params.assetKey);

    if (!assetUrl) {
      return res.status(404).json({ error: 'Asset not found.' });
    }

    return res.redirect(assetUrl);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to resolve asset.' });
  }
});

module.exports = router;
