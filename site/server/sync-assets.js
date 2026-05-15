require('dotenv').config();
const { preloadAssetMap } = require('./services/dropbox');

preloadAssetMap()
  .then(() => {
    console.log('[sync] Done.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[sync] Failed:', error.message);
    process.exit(1);
  });
