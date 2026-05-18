require('dotenv').config();
const { syncDropboxAssetsToDisk } = require('./services/dropbox');

syncDropboxAssetsToDisk()
  .then(() => {
    console.log('[sync] Done.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[sync] Failed:', error.message);
    process.exit(1);
  });
