require('dotenv').config();
const { syncDropboxAssetsAndPersist } = require('./services/dropbox');

const dryRun = process.argv.includes('--dry-run');

syncDropboxAssetsAndPersist({ dryRun })
  .then(() => {
    console.log(`[sync] Done${dryRun ? ' (dry run)' : ''}.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('[sync] Failed:', error.message);
    process.exit(1);
  });
