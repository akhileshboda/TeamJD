require('dotenv').config();
const { runAssetRebuild } = require('./services/assetSync');

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

const dryRun = process.argv.includes('--dry-run');
const confirm = getArgValue('--confirm');

runAssetRebuild({ dryRun, confirm })
  .then(({ plan, report }) => {
    if (dryRun) {
      console.log('[rebuild-assets] Dry run complete.');
      console.log(
        JSON.stringify(
          {
            ok: plan.ok,
            plannedUploads: plan.counts.planned,
            purgeDeletes: plan.counts.purgeDeletes,
            originalBytes: plan.sizeSummary.originalBytes,
            warnings: plan.warnings,
            errors: plan.errors
          },
          null,
          2
        )
      );
    } else {
      console.log('[rebuild-assets] Rebuild complete.');
      console.log(
        JSON.stringify(
          {
            ok: report.ok,
            uploadedToR2: report.uploadedToR2,
            deletedFromR2: report.deletedFromR2,
            failed: report.failed,
            manifestGeneratedAt: report.manifestGeneratedAt
          },
          null,
          2
        )
      );
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('[rebuild-assets] Failed:', error.message);
    if (error.details) {
      console.error(JSON.stringify(error.details, null, 2));
    }
    process.exit(1);
  });
