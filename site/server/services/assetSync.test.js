const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

function createEmptyPlan(fingerprint = 'test-fingerprint') {
  return {
    ok: true,
    dryRun: true,
    errors: [],
    plan: [],
    skipped: [],
    staleR2Deletes: [],
    counts: {
      discovered: 0,
      planned: 0,
      skipped: 0,
      staleDeletes: 0,
      errors: 0
    },
    baseManifestAssets: {},
    fingerprint
  };
}

async function withIsolatedSyncState(run) {
  const originalStatePath = process.env.ASSET_SYNC_STATE_PATH;
  const originalRefreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'teamjd-asset-sync-'));
  process.env.ASSET_SYNC_STATE_PATH = path.join(tempDir, 'asset-sync-state.json');
  delete process.env.DROPBOX_REFRESH_TOKEN;

  try {
    await run();
  } finally {
    if (originalStatePath === undefined) {
      delete process.env.ASSET_SYNC_STATE_PATH;
    } else {
      process.env.ASSET_SYNC_STATE_PATH = originalStatePath;
    }

    if (originalRefreshToken === undefined) {
      delete process.env.DROPBOX_REFRESH_TOKEN;
    } else {
      process.env.DROPBOX_REFRESH_TOKEN = originalRefreshToken;
    }

    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

test('first real sync requires a matching successful API dry-run plan', async () => {
  await withIsolatedSyncState(async () => {
    const { executeAssetSync, recordDryRun } = require('./assetSync');
    const plan = createEmptyPlan();

    await assert.rejects(
      executeAssetSync({ plan, allowConcurrent: true }),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, 'ASSET_SYNC_DRY_RUN_REQUIRED');
        return true;
      }
    );

    await recordDryRun(plan, { source: 'cli' });
    await assert.rejects(
      executeAssetSync({ plan, allowConcurrent: true }),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.equal(error.details.lastDryRunSource, 'cli');
        return true;
      }
    );

    await recordDryRun(plan, { source: 'api' });
    await assert.rejects(
      executeAssetSync({ plan, allowConcurrent: true }),
      /Dropbox refresh token is not configured/
    );
  });
});

test('trusted server-side sync records and approves its own dry-run', async () => {
  await withIsolatedSyncState(async () => {
    const { readSyncState, runTrustedAssetSync } = require('./assetSync');
    const plan = createEmptyPlan('trusted-cli-fingerprint');

    await assert.rejects(
      runTrustedAssetSync({ plan, source: 'cli', allowConcurrent: true }),
      /Dropbox refresh token is not configured/
    );

    const state = await readSyncState();
    assert.equal(state.lastDryRunSource, 'cli');
    assert.equal(state.lastDryRunFingerprint, 'trusted-cli-fingerprint');
    assert.equal(state.lastDryRunOk, true);
  });
});

test('trusted server-side sync does not execute invalid dry-run plans', async () => {
  await withIsolatedSyncState(async () => {
    const { runTrustedAssetSync } = require('./assetSync');
    const plan = {
      ...createEmptyPlan('invalid-plan-fingerprint'),
      ok: false,
      errors: [{ code: 'r2_not_configured', message: 'R2 is missing.' }]
    };

    await assert.rejects(
      runTrustedAssetSync({ plan, source: 'scheduler', allowConcurrent: true }),
      (error) => {
        assert.equal(error.code, 'ASSET_SYNC_PLAN_FAILED');
        assert.equal(error.statusCode, 409);
        return true;
      }
    );
  });
});

test('same-name organized Dropbox replacements are planned for upload when metadata changes', () => {
  const { getOrganizedAssetSyncAction } = require('./assetSync');
  const existingAsset = {
    assetVersion: 'rev-a:hash-a:100',
    rev: 'rev-a',
    contentHash: 'hash-a',
    r2ObjectKey: 'site-assets/home/hero.jpg'
  };

  assert.equal(
    getOrganizedAssetSyncAction(
      existingAsset,
      {
        dropboxPath: '/assets/home/hero.jpg',
        assetVersion: 'rev-a:hash-a:100',
        rev: 'rev-a',
        contentHash: 'hash-a'
      },
      true
    ),
    'skip-unchanged'
  );

  assert.equal(
    getOrganizedAssetSyncAction(
      existingAsset,
      {
        dropboxPath: '/assets/home/hero.jpg',
        assetVersion: 'rev-b:hash-b:100',
        rev: 'rev-b',
        contentHash: 'hash-b'
      },
      true
    ),
    'upload-existing-to-r2'
  );
});

test('scheduled sync skips when another sync is already running', async () => {
  const { runScheduledAssetSync } = require('./assetSync');
  const result = await runScheduledAssetSync({ syncInProgress: true });

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'already-running');
});

test('scheduled sync skips cleanly when watched Dropbox paths have no changes', async () => {
  const { runScheduledAssetSync } = require('./assetSync');
  const result = await runScheduledAssetSync({
    checkChanges: async () => ({ changed: false, changedPaths: [] })
  });

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'no-dropbox-changes');
});

test('scheduled sync runs when /latest changes', async () => {
  const { runScheduledAssetSync } = require('./assetSync');
  let ran = false;
  const result = await runScheduledAssetSync({
    checkChanges: async () => ({ changed: true, changedPaths: ['/latest'] }),
    runSync: async () => {
      ran = true;
      return { ok: true };
    }
  });

  assert.equal(ran, true);
  assert.equal(result.skipped, false);
  assert.deepEqual(result.changedPaths, ['/latest']);
});

test('scheduled sync runs when organized /assets changes', async () => {
  const { runScheduledAssetSync } = require('./assetSync');
  let ran = false;
  const result = await runScheduledAssetSync({
    checkChanges: async () => ({ changed: true, changedPaths: ['/assets'] }),
    runSync: async () => {
      ran = true;
      return { ok: true };
    }
  });

  assert.equal(ran, true);
  assert.equal(result.skipped, false);
  assert.deepEqual(result.changedPaths, ['/assets']);
});

test('creates cleanup-only plan items for uploaded assets whose Dropbox move failed', () => {
  const { getCleanupRetryItems } = require('./assetSync');
  const items = getCleanupRetryItems(
    {
      files: {
        '/hero-bg.jpg': {
          originalDropboxPath: '/hero-bg.jpg',
          organizedDropboxPath: '/assets/home/hero-bg.jpg',
          category: 'home',
          assetKey: 'hero-bg',
          r2ObjectKey: 'site-assets/home/hero-bg.jpg',
          dropboxMoveStatus: 'requires-cleanup',
          r2UploadStatus: 'uploaded',
          manifestStatus: 'written',
          rev: 'rev-a',
          contentHash: 'hash-a'
        }
      }
    },
    {
      assets: {
        'hero-bg': {
          key: 'hero-bg',
          category: 'home',
          name: 'hero-bg.jpg',
          contentType: 'image/jpeg',
          r2ObjectKey: 'site-assets/home/hero-bg.jpg',
          url: 'https://assets.example/site-assets/home/hero-bg.jpg',
          assetVersion: 'rev-a:hash-a'
        }
      }
    },
    'site-assets'
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].action, 'move-dropbox-file-cleanup');
  assert.equal(items[0].source, '/hero-bg.jpg');
  assert.equal(items[0].dropboxDestination, '/assets/home/hero-bg.jpg');
  assert.equal(items[0].r2ObjectKey, 'site-assets/home/hero-bg.jpg');
});

test('recognizes Dropbox folder conflict errors from nested SDK payloads', () => {
  const { isDropboxFolderConflictError } = require('./assetSync');
  assert.equal(
    isDropboxFolderConflictError({
      message: 'Response failed with a 409 code',
      error: {
        error: {
          '.tag': 'path',
          path: {
            '.tag': 'conflict',
            conflict: { '.tag': 'folder' }
          }
        },
        error_summary: 'path/conflict/folder/'
      }
    }),
    true
  );
});

test('recognizes Dropbox missing-source move errors from nested SDK payloads', () => {
  const { isDropboxFromLookupNotFoundError } = require('./assetSync');
  assert.equal(
    isDropboxFromLookupNotFoundError({
      message: 'Response failed with a 409 code',
      error: {
        error_summary: 'from_lookup/not_found/'
      }
    }),
    true
  );
});
