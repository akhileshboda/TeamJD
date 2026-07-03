const crypto = require('crypto');
const fsSync = require('fs');
const fs = require('fs/promises');
const path = require('path');
const cron = require('node-cron');
const { Dropbox, DropboxAuth } = require('dropbox');
const {
  CATEGORIES,
  classifyAsset,
  createAssetVersion,
  createR2ObjectKey,
  getAssetKey,
  getContentType,
  getExtension,
  getSafeFileName,
  isPathInside,
  isSupportedAsset,
  joinDropboxPath,
  normalizeDropboxPath
} = require('./assetClassifier');
const {
  deleteR2Object,
  getPublicR2Url,
  getR2Config,
  getR2ConfigStatus,
  headR2Object,
  isR2Configured,
  listR2ObjectKeys,
  putR2Object,
  verifyR2Bucket
} = require('./r2');
const {
  createAssetManifest,
  readDiskManifest,
  writeDiskManifest
} = require('./assetManifest');

const DROPBOX_FETCH_TIMEOUT_MS = 30_000;
const DEFAULT_SYNC_STATE_PATH = path.join(__dirname, '..', '..', 'data', 'asset-sync-state.json');
const DEFAULT_CRON = '*/15 * * * *';

let cachedManifest = null;
let syncInProgress = false;
let scheduledTask = null;
let lastError = null;
let lastSyncReport = null;
const schedulerState = {
  enabled: false,
  startedAt: null,
  cron: null,
  watchedPaths: [],
  lastRunStartedAt: null,
  lastRunCompletedAt: null,
  lastChangeCheckAt: null,
  lastSyncStartedAt: null,
  lastSyncCompletedAt: null,
  lastSkippedReason: null
};

function nowIso() {
  return new Date().toISOString();
}

function getSyncStatePath() {
  return process.env.ASSET_SYNC_STATE_PATH || DEFAULT_SYNC_STATE_PATH;
}

function getSyncConfig() {
  return {
    enabled: process.env.ASSET_SYNC_ENABLED !== 'false',
    onBoot: process.env.ASSET_SYNC_ON_BOOT !== 'false',
    cron: process.env.ASSET_SYNC_CRON || DEFAULT_CRON,
    adminTokenConfigured: Boolean(process.env.ASSET_SYNC_ADMIN_TOKEN),
    reorganizeEnabled: process.env.DROPBOX_REORGANIZE_ENABLED !== 'false',
    latestPath: normalizeDropboxPath(process.env.DROPBOX_LATEST_PATH || '/latest'),
    assetsRoot: normalizeDropboxPath(process.env.DROPBOX_ASSETS_ROOT || '/assets')
  };
}

function getWatchedDropboxPaths(syncConfig = getSyncConfig()) {
  return [
    { key: 'latest', path: syncConfig.latestPath },
    { key: 'assets', path: syncConfig.assetsRoot }
  ];
}

function getMissingConfig() {
  const required = [
    'DROPBOX_APP_KEY',
    'DROPBOX_APP_SECRET',
    'DROPBOX_REFRESH_TOKEN',
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_PUBLIC_BASE_URL',
    'R2_ASSET_PREFIX'
  ];

  return required.filter((key) => !process.env[key] && !(key === 'R2_BUCKET_NAME' && process.env.R2_BUCKET));
}

function createDropboxClient(authState = {}) {
  const refreshToken = authState.refreshToken || process.env.DROPBOX_REFRESH_TOKEN;
  const accessToken = authState.accessToken;

  if (!refreshToken && !accessToken) return null;

  const auth = new DropboxAuth({
    clientId: process.env.DROPBOX_APP_KEY,
    clientSecret: process.env.DROPBOX_APP_SECRET,
    accessToken,
    refreshToken
  });

  return new Dropbox({ auth });
}

function sanitizeErrorMessage(message) {
  return String(message || 'Unknown asset sync error.')
    .replace(/https?:\/\/\S+/gi, (rawUrl) => {
      try {
        const parsedUrl = new URL(rawUrl);
        parsedUrl.search = parsedUrl.search ? '?[redacted]' : '';
        return parsedUrl.toString();
      } catch (_) {
        return '[redacted-url]';
      }
    })
    .replace(/\b(refresh_token|access_token|client_secret|client_id|secret_access_key)=([^&\s]+)/gi, '$1=[redacted]');
}

function getErrorSummary(error) {
  const providerError =
    typeof error?.error === 'string'
      ? sanitizeErrorMessage(error.error)
      : sanitizeErrorMessage(error?.error?.error_summary || error?.error?.error?.error_summary || '');

  return {
    name: error?.name || 'Error',
    message: sanitizeErrorMessage(error?.message),
    status: error?.status || error?.statusCode || error?.$metadata?.httpStatusCode || null,
    providerError: providerError || null
  };
}

async function readJsonFile(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' && fallback !== null) return fallback;
    throw error;
  }
}

async function writeJsonFile(filePath, payload) {
  const tmpPath = `${filePath}.tmp`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tmpPath, `${JSON.stringify(payload, null, 2)}\n`);
  await fs.rename(tmpPath, filePath);
}

function normalizeSyncState(state = {}) {
  return {
    dropboxCursor: state.dropboxCursor || null,
    dropboxCursors: state.dropboxCursors && typeof state.dropboxCursors === 'object' ? state.dropboxCursors : {},
    lastSyncAt: state.lastSyncAt || null,
    lastSuccessfulSyncAt: state.lastSuccessfulSyncAt || null,
    lastDryRunCompletedAt: state.lastDryRunCompletedAt || null,
    lastDryRunFingerprint: state.lastDryRunFingerprint || null,
    lastDryRunSource: state.lastDryRunSource || null,
    lastDryRunOk: Boolean(state.lastDryRunOk),
    firstRealSyncCompletedAt: state.firstRealSyncCompletedAt || null,
    latestInboxInspectedAt: state.latestInboxInspectedAt || null,
    files: state.files && typeof state.files === 'object' ? state.files : {},
    r2Keys: Array.isArray(state.r2Keys) ? state.r2Keys : [],
    managedR2Keys: Array.isArray(state.managedR2Keys) ? state.managedR2Keys : [],
    deletedR2Keys: Array.isArray(state.deletedR2Keys) ? state.deletedR2Keys : [],
    lastCounts: state.lastCounts || null
  };
}

async function readSyncState() {
  return normalizeSyncState(await readJsonFile(getSyncStatePath(), {}));
}

function readSyncStateSnapshot() {
  try {
    return normalizeSyncState(JSON.parse(fsSync.readFileSync(getSyncStatePath(), 'utf8')));
  } catch (_) {
    return normalizeSyncState({});
  }
}

async function writeSyncState(state) {
  await writeJsonFile(getSyncStatePath(), state);
  return state;
}

async function listDropboxEntries(dropboxClient, folderPath) {
  const entries = [];
  let response = await dropboxClient.filesListFolder({
    path: folderPath,
    recursive: true,
    include_deleted: false,
    include_non_downloadable_files: false
  });

  entries.push(...response.result.entries);

  while (response.result.has_more) {
    response = await dropboxClient.filesListFolderContinue({ cursor: response.result.cursor });
    entries.push(...response.result.entries);
  }

  return entries;
}

async function listFilesRecursive(folderPath, options = {}) {
  const dropboxClient = options.dropboxClient || createDropboxClient(options.authState);
  if (!dropboxClient) throw new Error('Dropbox refresh token is not configured.');
  return listDropboxEntries(dropboxClient, folderPath);
}

async function listLatestAssets(options = {}) {
  return listFilesRecursive(getSyncConfig().latestPath, options);
}

async function getDropboxFileMetadata(dropboxPath, options = {}) {
  const dropboxClient = options.dropboxClient || createDropboxClient(options.authState);
  if (!dropboxClient) throw new Error('Dropbox refresh token is not configured.');
  const response = await dropboxClient.filesGetMetadata({ path: dropboxPath });
  return response.result;
}

async function fileExists(dropboxPath, options = {}) {
  try {
    await getDropboxFileMetadata(dropboxPath, options);
    return true;
  } catch (error) {
    const status = error?.status || error?.statusCode || error?.error?.status;
    if (status === 409 || /not_found/i.test(String(error?.message || ''))) return false;
    throw error;
  }
}

async function ensureDropboxFolder(folderPath, options = {}) {
  const dropboxClient = options.dropboxClient || createDropboxClient(options.authState);
  if (!dropboxClient) throw new Error('Dropbox refresh token is not configured.');

  const segments = normalizeDropboxPath(folderPath).split('/').filter(Boolean);
  let current = '';

  for (const segment of segments) {
    current = joinDropboxPath(current, segment);
    try {
      await dropboxClient.filesCreateFolderV2({ path: current, autorename: false });
      console.log(`[asset-sync] dropbox-folder-created path=${current}`);
    } catch (error) {
      if (isDropboxFolderConflictError(error)) continue;
      throw error;
    }
  }
}

async function moveDropboxFile(fromPath, toPath, options = {}) {
  const dropboxClient = options.dropboxClient || createDropboxClient(options.authState);
  if (!dropboxClient) throw new Error('Dropbox refresh token is not configured.');

  await ensureDropboxFolder(path.posix.dirname(toPath), { dropboxClient });
  const response = await dropboxClient.filesMoveV2({
    from_path: fromPath,
    to_path: toPath,
    allow_shared_folder: false,
    autorename: false,
    allow_ownership_transfer: false
  });
  console.log(`[asset-sync] dropbox-file-moved from=${fromPath} to=${toPath}`);
  return response.result.metadata;
}

async function downloadDropboxFile(dropboxPath, options = {}) {
  const dropboxClient = options.dropboxClient || createDropboxClient(options.authState);
  if (!dropboxClient) throw new Error('Dropbox refresh token is not configured.');

  await dropboxClient.auth.checkAndRefreshAccessToken();
  const token = dropboxClient.auth.getAccessToken();
  if (!token) throw new Error('Dropbox access token unavailable after refresh attempt.');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DROPBOX_FETCH_TIMEOUT_MS);
  let response;

  try {
    response = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath })
      },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Dropbox download failed (${response.status}): ${body.slice(0, 200)}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function createEntryVersion(entry) {
  return createAssetVersion(entry);
}

function isFileEntry(entry) {
  return entry?.['.tag'] === 'file';
}

function toFileInfo(entry) {
  const dropboxPath = entry.path_display || entry.path_lower || entry.name;
  return {
    id: entry.id || null,
    name: entry.name,
    dropboxPath,
    pathLower: entry.path_lower || dropboxPath.toLowerCase(),
    extension: getExtension(entry.name),
    rev: entry.rev || null,
    contentHash: entry.content_hash || null,
    size: entry.size || null,
    clientModified: entry.client_modified || null,
    serverModified: entry.server_modified || null,
    assetVersion: createEntryVersion(entry),
    raw: entry
  };
}

function createPlanFingerprint(plan) {
  const payload = {
    uploads: plan.plan.map((item) => ({
      source: item.source,
      rev: item.rev,
      contentHash: item.contentHash,
      dropboxDestination: item.dropboxDestination,
      r2ObjectKey: item.r2ObjectKey,
      action: item.action
    })),
    deletes: plan.staleR2Deletes.map((item) => ({
      r2ObjectKey: item.r2ObjectKey,
      action: item.action,
      blocked: Boolean(item.blocked)
    })),
    skipped: plan.skipped.map((item) => ({
      source: item.source,
      reason: item.reason
    }))
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function addManifestAsset(assetMap, item, overrides = {}) {
  assetMap[item.assetKey] = {
    key: item.assetKey,
    category: item.category,
    url: item.url,
    name: item.normalizedName,
    r2ObjectKey: item.r2ObjectKey,
    r2Key: item.r2ObjectKey,
    dropboxPath: item.dropboxDestination,
    originalDropboxPath: item.source,
    contentType: item.contentType,
    width: null,
    height: null,
    updatedAt: overrides.updatedAt || nowIso(),
    rev: item.rev || null,
    contentHash: item.contentHash || null,
    size: item.size || null,
    assetVersion: item.assetVersion || null,
    extension: item.extension,
    source: 'dropbox-latest-to-r2',
    ...overrides
  };
}

function getExistingAssetFromManifest(manifest, assetKey) {
  return manifest?.assets?.[assetKey] || null;
}

function sameVersion(asset, fileInfo) {
  if (!asset) return false;
  if (asset.assetVersion && fileInfo.assetVersion) return asset.assetVersion === fileInfo.assetVersion;
  if (asset.rev && fileInfo.rev) return asset.rev === fileInfo.rev;
  return asset.size === fileInfo.size && asset.serverModified === fileInfo.serverModified;
}

function getOrganizedAssetSyncAction(existingAsset, fileInfo, r2ObjectExists) {
  return sameVersion(existingAsset, fileInfo) && r2ObjectExists ? 'skip-unchanged' : 'upload-existing-to-r2';
}

function isDropboxNotFoundError(error) {
  return /not_found/i.test([
    error?.message,
    error?.error?.error_summary,
    error?.error?.error?.error_summary
  ].filter(Boolean).join(' '));
}

function isDropboxFolderConflictError(error) {
  return /conflict\/folder/i.test([
    error?.message,
    error?.error?.error_summary,
    error?.error?.error?.error_summary
  ].filter(Boolean).join(' '));
}

function isDropboxFromLookupNotFoundError(error) {
  return /from_lookup\/not_found/i.test([
    error?.message,
    error?.error?.error_summary,
    error?.error?.error?.error_summary
  ].filter(Boolean).join(' '));
}

function isDropboxCursorResetError(error) {
  return /reset/i.test([
    error?.message,
    error?.error?.error_summary,
    error?.error?.error?.error_summary
  ].filter(Boolean).join(' '));
}

function getUniqueAssetKey(preferredKey, assetMap) {
  const baseKey = preferredKey || 'asset';
  let candidate = baseKey;
  let suffix = 2;

  while (assetMap[candidate]) {
    candidate = `${baseKey}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function getBucketLookupDiagnostics(bucketLookup) {
  if (!bucketLookup) return null;
  return {
    configuredBucket: bucketLookup.bucket,
    accountId: bucketLookup.accountId,
    accountIdPrefix: bucketLookup.accountIdPrefix,
    publicBaseUrl: bucketLookup.publicBaseUrl,
    bucketReachable: bucketLookup.bucketReachable,
    bucketLookupMethod: bucketLookup.bucketLookupMethod,
    headBucketRan: bucketLookup.headBucketRan,
    listBucketsRan: bucketLookup.listBucketsRan,
    candidateBuckets: bucketLookup.candidateBuckets || [],
    bucketLookupError: bucketLookup.bucketLookupError || null
  };
}

function getBucketLookupStatus(bucketLookup) {
  const lookupError = bucketLookup?.bucketLookupError;
  return (
    lookupError?.headBucketError?.status ||
    lookupError?.listBucketsError?.status ||
    lookupError?.status ||
    null
  );
}

function getCleanupRetryItems(syncState, existingManifest, assetPrefix) {
  const items = [];

  for (const fileState of Object.values(syncState.files || {})) {
    if (fileState?.dropboxMoveStatus !== 'requires-cleanup') continue;
    if (!fileState.originalDropboxPath || !fileState.organizedDropboxPath || !fileState.assetKey) continue;

    const manifestAsset = existingManifest?.assets?.[fileState.assetKey] || {};
    const normalizedName = path.posix.basename(fileState.organizedDropboxPath);
    const category = fileState.category || manifestAsset.category || classifyAsset({
      fileName: normalizedName,
      dropboxPath: fileState.organizedDropboxPath
    });
    const r2ObjectKey =
      fileState.r2ObjectKey ||
      manifestAsset.r2ObjectKey ||
      createR2ObjectKey({ assetPrefix, category, fileName: normalizedName });

    items.push({
      source: fileState.originalDropboxPath,
      category,
      normalizedName,
      dropboxDestination: fileState.organizedDropboxPath,
      r2ObjectKey,
      assetKey: fileState.assetKey,
      contentType: manifestAsset.contentType || getContentType(normalizedName),
      action: 'move-dropbox-file-cleanup',
      rev: fileState.rev || manifestAsset.rev || null,
      contentHash: fileState.contentHash || manifestAsset.contentHash || null,
      size: manifestAsset.size || null,
      assetVersion: manifestAsset.assetVersion || null,
      extension: manifestAsset.extension || getExtension(normalizedName),
      url: manifestAsset.url || getPublicR2Url(r2ObjectKey, manifestAsset.assetVersion),
      sourceKind: 'requires-cleanup'
    });
  }

  return items.sort((a, b) => a.source.localeCompare(b.source));
}

async function listLegacyManifestFiles(dropboxClient, existingManifest, syncConfig, knownDropboxPaths) {
  const files = [];
  const skipped = [];

  for (const [assetKey, asset] of Object.entries(existingManifest?.assets || {})) {
    const dropboxPath = normalizeDropboxPath(asset.dropboxPath || '');
    if (!dropboxPath) continue;
    if (isPathInside(syncConfig.assetsRoot, dropboxPath)) continue;
    if (isPathInside(syncConfig.latestPath, dropboxPath)) continue;
    if (knownDropboxPaths.has(dropboxPath.toLowerCase())) continue;

    try {
      const metadata = await getDropboxFileMetadata(dropboxPath, { dropboxClient });
      if (!isFileEntry(metadata)) continue;
      const fileInfo = toFileInfo(metadata);
      files.push({
        ...fileInfo,
        legacyAssetKey: assetKey,
        legacyCategory: CATEGORIES.includes(asset.category) ? asset.category : null
      });
      knownDropboxPaths.add(dropboxPath.toLowerCase());
    } catch (error) {
      if (isDropboxNotFoundError(error)) {
        skipped.push({
          source: dropboxPath,
          name: asset.name || path.posix.basename(dropboxPath),
          reason: 'legacy-dropbox-source-missing',
          action: 'drop-from-next-r2-manifest'
        });
        continue;
      }
      throw error;
    }
  }

  return { files, skipped };
}

async function buildAssetSyncPlan(options = {}) {
  const startedAt = nowIso();
  const syncConfig = getSyncConfig();
  const missingConfig = getMissingConfig();
  const errors = [];

  if (!isR2Configured()) {
    errors.push({
      code: 'r2_not_configured',
      message: 'Cloudflare R2 is not fully configured.',
      missing: missingConfig.filter((key) => key.startsWith('R2_'))
    });
  }

  const dropboxClient = createDropboxClient(options.authState);
  if (!dropboxClient) {
    errors.push({
      code: 'dropbox_not_configured',
      message: 'Dropbox refresh token is not configured.'
    });
  }

  if (errors.length) {
    const plan = {
      ok: false,
      dryRun: true,
      startedAt,
      finishedAt: nowIso(),
      latestFilesFound: 0,
      plan: [],
      skipped: [],
      staleR2Deletes: [],
      errors,
      counts: {
        discovered: 0,
        planned: 0,
        skipped: 0,
        staleDeletes: 0,
        errors: errors.length
      }
    };
    plan.fingerprint = createPlanFingerprint(plan);
    return plan;
  }

  const [latestEntries, organizedEntries, existingManifest, syncState, bucketLookup] = await Promise.all([
    listDropboxEntries(dropboxClient, syncConfig.latestPath).catch((error) => {
      if (isDropboxNotFoundError(error)) return [];
      throw error;
    }),
    listDropboxEntries(dropboxClient, syncConfig.assetsRoot).catch((error) => {
      if (isDropboxNotFoundError(error)) return [];
      throw error;
    }),
    readDiskManifest({ allowMissing: true }),
    readSyncState(),
    verifyR2Bucket()
  ]);

  let r2Keys = [];

  if (!bucketLookup.bucketReachable) {
    errors.push({
      code: bucketLookup.bucketLookupError?.code || 'r2_bucket_lookup_failed',
      message: bucketLookup.bucketLookupError?.message || 'Cloudflare R2 bucket lookup failed.',
      status: getBucketLookupStatus(bucketLookup),
      diagnostics: getBucketLookupDiagnostics(bucketLookup)
    });
  } else {
    const r2ListError = await listR2ObjectKeys(getR2Config().assetPrefix).catch((error) => error);
    if (Array.isArray(r2ListError)) {
      r2Keys = r2ListError;
    } else {
      errors.push({
        code: 'r2_list_failed',
        message: getErrorSummary(r2ListError).message,
        status: r2ListError?.$metadata?.httpStatusCode || r2ListError?.statusCode || null,
        diagnostics: getBucketLookupDiagnostics(bucketLookup)
      });
    }
  }

  if (bucketLookup.bucketLookupError && bucketLookup.bucketReachable) {
    console.warn(
      `[asset-sync] r2-bucket-lookup-warning code=${bucketLookup.bucketLookupError.code} message="${bucketLookup.bucketLookupError.message}"`
    );
  }

  const latestFiles = latestEntries.filter(isFileEntry).map(toFileInfo);
  const organizedFiles = organizedEntries.filter(isFileEntry).map(toFileInfo);
  const knownDropboxPaths = new Set(
    [...latestFiles, ...organizedFiles].map((file) => normalizeDropboxPath(file.dropboxPath).toLowerCase())
  );
  const legacyManifest =
    syncState.firstRealSyncCompletedAt || existingManifest.source === 'dropbox-latest-to-r2'
      ? { files: [], skipped: [] }
      : await listLegacyManifestFiles(dropboxClient, existingManifest, syncConfig, knownDropboxPaths);
  const legacyFiles = legacyManifest.files;
  const reservedByCategory = CATEGORIES.reduce((acc, category) => {
    acc[category] = new Set();
    return acc;
  }, {});

  for (const file of organizedFiles) {
    const segments = normalizeDropboxPath(file.dropboxPath).split('/').filter(Boolean);
    const category = segments[1] && CATEGORIES.includes(segments[1]) ? segments[1] : classifyAsset({
      fileName: file.name,
      dropboxPath: file.dropboxPath
    });
    reservedByCategory[category].add(file.name.toLowerCase());
  }

  const assetMap = {};
  const baseManifestAssets = {};
  const planItems = [];
  const skipped = [...legacyManifest.skipped];
  const seenR2Keys = new Set();
  const { assetPrefix } = getR2Config();
  const cleanupRetryItems = getCleanupRetryItems(syncState, existingManifest, assetPrefix);

  for (const file of organizedFiles) {
    if (!isSupportedAsset(file.name)) {
      skipped.push({
        source: file.dropboxPath,
        name: file.name,
        reason: 'unsupported-file-type',
        action: 'skip'
      });
      continue;
    }

    const segments = normalizeDropboxPath(file.dropboxPath).split('/').filter(Boolean);
    const category = segments[1] && CATEGORIES.includes(segments[1]) ? segments[1] : classifyAsset({
      fileName: file.name,
      dropboxPath: file.dropboxPath
    });
    const normalizedName = file.name.toLowerCase();
    const assetKey = getAssetKey(normalizedName);
    const r2ObjectKey = createR2ObjectKey({ assetPrefix, category, fileName: normalizedName });
    const existingAsset = getExistingAssetFromManifest(existingManifest, assetKey);
    const r2ObjectExists = r2Keys.includes(r2ObjectKey);
    const action = getOrganizedAssetSyncAction(existingAsset, file, r2ObjectExists);

    seenR2Keys.add(r2ObjectKey);
    addManifestAsset(assetMap, {
      ...file,
      source: file.dropboxPath,
      category,
      normalizedName,
      dropboxDestination: file.dropboxPath,
      r2ObjectKey,
      assetKey,
      url: getPublicR2Url(r2ObjectKey, file.assetVersion),
      contentType: getContentType(normalizedName),
      action
    });

    if (action === 'skip-unchanged') {
      addManifestAsset(baseManifestAssets, {
        ...file,
        source: file.dropboxPath,
        category,
        normalizedName,
        dropboxDestination: file.dropboxPath,
        r2ObjectKey,
        assetKey,
        url: getPublicR2Url(r2ObjectKey, file.assetVersion),
        contentType: getContentType(normalizedName),
        action
      });
    } else {
      planItems.push({
        source: file.dropboxPath,
        category,
        normalizedName,
        dropboxDestination: file.dropboxPath,
        r2ObjectKey,
        assetKey,
        contentType: getContentType(normalizedName),
        action,
        rev: file.rev,
        contentHash: file.contentHash,
        size: file.size,
        assetVersion: file.assetVersion,
        extension: file.extension,
        url: getPublicR2Url(r2ObjectKey, file.assetVersion)
      });
    }
  }

  for (const file of legacyFiles) {
    if (!isSupportedAsset(file.name)) {
      skipped.push({
        source: file.dropboxPath,
        name: file.name,
        reason: 'unsupported-file-type',
        action: 'leave-legacy-source-in-place'
      });
      continue;
    }

    const category =
      file.legacyCategory || classifyAsset({ fileName: file.name, dropboxPath: file.dropboxPath });
    const normalizedName = getSafeFileName(file.name, reservedByCategory[category]);
    reservedByCategory[category].add(normalizedName.toLowerCase());
    const preferredAssetKey = file.legacyAssetKey || getAssetKey(normalizedName);
    const assetKey = getUniqueAssetKey(preferredAssetKey, assetMap);
    const dropboxDestination = joinDropboxPath(syncConfig.assetsRoot, category, normalizedName);
    const r2ObjectKey = createR2ObjectKey({ assetPrefix, category, fileName: normalizedName });
    const item = {
      source: file.dropboxPath,
      category,
      normalizedName,
      dropboxDestination,
      r2ObjectKey,
      assetKey,
      contentType: getContentType(normalizedName),
      action: syncConfig.reorganizeEnabled
        ? 'upload-to-r2-write-manifest-and-move-dropbox-file'
        : 'upload-to-r2-write-manifest',
      rev: file.rev,
      contentHash: file.contentHash,
      size: file.size,
      assetVersion: file.assetVersion,
      extension: file.extension,
      url: getPublicR2Url(r2ObjectKey, file.assetVersion),
      sourceKind: 'legacy-manifest'
    };
    seenR2Keys.add(r2ObjectKey);
    planItems.push(item);
    addManifestAsset(assetMap, item);

    console.log(
      `[asset-sync] legacy-classified source="${file.dropboxPath}" category=${category} normalized=${normalizedName} r2=${r2ObjectKey}`
    );
  }

  for (const file of latestFiles) {
    if (!isSupportedAsset(file.name)) {
      skipped.push({
        source: file.dropboxPath,
        name: file.name,
        reason: 'unsupported-file-type',
        action: 'leave-in-latest'
      });
      continue;
    }

    const category = classifyAsset({ fileName: file.name, dropboxPath: file.dropboxPath });
    const normalizedName = getSafeFileName(file.name, reservedByCategory[category]);
    reservedByCategory[category].add(normalizedName.toLowerCase());
    const assetKey = getAssetKey(normalizedName);
    const dropboxDestination = joinDropboxPath(syncConfig.assetsRoot, category, normalizedName);
    const r2ObjectKey = createR2ObjectKey({ assetPrefix, category, fileName: normalizedName });
    const item = {
      source: file.dropboxPath,
      category,
      normalizedName,
      dropboxDestination,
      r2ObjectKey,
      assetKey,
      contentType: getContentType(normalizedName),
      action: syncConfig.reorganizeEnabled
        ? 'upload-to-r2-write-manifest-and-move-dropbox-file'
        : 'upload-to-r2-write-manifest',
      rev: file.rev,
      contentHash: file.contentHash,
      size: file.size,
      assetVersion: file.assetVersion,
      extension: file.extension,
      url: getPublicR2Url(r2ObjectKey, file.assetVersion)
    };
    seenR2Keys.add(r2ObjectKey);
    planItems.push(item);
    addManifestAsset(assetMap, item);

    console.log(
      `[asset-sync] classified source="${file.dropboxPath}" category=${category} normalized=${normalizedName} r2=${r2ObjectKey}`
    );
  }

  for (const item of cleanupRetryItems) {
    if (planItems.some((planned) => planned.source === item.source)) continue;
    seenR2Keys.add(item.r2ObjectKey);
    planItems.push(item);
    if (!assetMap[item.assetKey]) {
      addManifestAsset(assetMap, item);
    }
  }

  const managedR2Keys = new Set([...(syncState.managedR2Keys || []), ...(syncState.r2Keys || [])]);
  const staleR2Deletes = Array.from(new Set([...managedR2Keys, ...r2Keys]))
    .filter((r2ObjectKey) => r2ObjectKey && r2ObjectKey.startsWith(`${assetPrefix}/`) && !seenR2Keys.has(r2ObjectKey))
    .map((r2ObjectKey) => ({
      r2ObjectKey,
      action: managedR2Keys.has(r2ObjectKey)
        ? 'delete-stale-r2-object'
        : 'would-delete-stale-r2-object-after-managed-sync',
      blocked: !managedR2Keys.has(r2ObjectKey),
      reason: managedR2Keys.has(r2ObjectKey) ? 'dropbox-source-removed' : 'unmanaged-r2-object'
    }));

  const manifest = createAssetManifest(assetMap, 'dropbox-latest-to-r2');
  const plan = {
    ok: errors.length === 0,
    dryRun: true,
    startedAt,
    finishedAt: nowIso(),
    latestFilesFound: latestFiles.length,
    plan: planItems,
    skipped,
    staleR2Deletes,
    errors,
    r2Bucket: getBucketLookupDiagnostics(bucketLookup),
    manifestPreview: {
      generatedAt: manifest.generatedAt,
      assetCount: manifest.assetCount,
      byCategory: manifest.byCategory
    },
    baseManifestAssets,
    desiredManifestAssets: assetMap,
    counts: {
      discovered: latestFiles.length + organizedFiles.length + legacyFiles.length,
      latestFiles: latestFiles.length,
      organizedFiles: organizedFiles.length,
      legacyFiles: legacyFiles.length,
      cleanupRetries: cleanupRetryItems.length,
      planned: planItems.length,
      skipped: skipped.length,
      staleDeletes: staleR2Deletes.length,
      blockedStaleDeletes: staleR2Deletes.filter((item) => item.blocked).length,
      errors: errors.length
    }
  };
  plan.fingerprint = createPlanFingerprint(plan);
  return plan;
}

async function recordDryRun(plan, options = {}) {
  const state = await readSyncState();
  return writeSyncState({
    ...state,
    lastDryRunCompletedAt: nowIso(),
    lastDryRunFingerprint: plan.fingerprint,
    lastDryRunSource: options.source || 'internal',
    lastDryRunOk: Boolean(plan.ok && !plan.errors.length)
  });
}

async function runTrustedAssetSync(options = {}) {
  const source = options.source || 'cli';
  const plan = options.plan || await buildAssetSyncPlan(options);

  await recordDryRun(plan, { source });
  return executeAssetSync({
    ...options,
    plan,
    requireFreshPlan: false,
    approvedDryRunSources: [source],
    reason: options.reason || `${source}-sync`
  });
}

function createExecutionError(message, details = {}) {
  const error = new Error(message);
  error.details = details;
  if (details.code) error.code = details.code;
  if (details.statusCode) error.statusCode = details.statusCode;
  return error;
}

async function executeAssetSync(options = {}) {
  if (syncInProgress && !options.allowConcurrent) {
    return {
      ok: false,
      skipped: true,
      reason: 'sync-already-running'
    };
  }

  syncInProgress = true;
  const startedAt = nowIso();
  const startedMs = Date.now();

  try {
    let state = await readSyncState();
    let plan = options.plan || null;

    if (!plan || options.requireFreshPlan) {
      plan = await buildAssetSyncPlan(options);
    }

    if (!plan.ok || plan.errors.length) {
      throw createExecutionError('Dry-run asset sync plan failed; real sync was not started.', {
        code: 'ASSET_SYNC_PLAN_FAILED',
        statusCode: 409,
        errors: plan.errors,
        fingerprint: plan.fingerprint
      });
    }

    const approvedDryRunSources = options.approvedDryRunSources || ['api'];
    if (
      !state.firstRealSyncCompletedAt &&
      (!approvedDryRunSources.includes(state.lastDryRunSource) ||
        state.lastDryRunOk !== true ||
        state.lastDryRunFingerprint !== plan.fingerprint)
    ) {
      throw createExecutionError('First real sync requires a matching successful dry-run from GET /api/assets/sync/plan.', {
        code: 'ASSET_SYNC_DRY_RUN_REQUIRED',
        statusCode: 409,
        expected: plan.fingerprint,
        actual: state.lastDryRunFingerprint,
        lastDryRunSource: state.lastDryRunSource,
        lastDryRunCompletedAt: state.lastDryRunCompletedAt
      });
    }

    const dropboxClient = createDropboxClient(options.authState);
    if (!dropboxClient) throw new Error('Dropbox refresh token is not configured.');

    const assetMap = { ...(plan.baseManifestAssets || {}) };
    const fileStates = { ...state.files };
    const uploadedItems = [];
    const failedItems = [];
    let uploadedToR2 = 0;
    let skippedUploads = 0;
    let deletedFromR2 = 0;

    console.log(`[asset-sync] sync-start fingerprint=${plan.fingerprint} planned=${plan.plan.length}`);

    for (const item of plan.plan) {
      if (item.action === 'skip-unchanged') {
        skippedUploads += 1;
        continue;
      }

      try {
        if (item.action === 'move-dropbox-file-cleanup') {
          if (!assetMap[item.assetKey]) {
            addManifestAsset(assetMap, item, {
              updatedAt: nowIso()
            });
          }
          uploadedItems.push(item);
          fileStates[item.source] = {
            ...(fileStates[item.source] || {}),
            originalDropboxPath: item.source,
            organizedDropboxPath: item.dropboxDestination,
            category: item.category,
            assetKey: item.assetKey,
            r2ObjectKey: item.r2ObjectKey,
            url: item.url,
            dropboxMoveStatus: 'pending',
            r2UploadStatus: fileStates[item.source]?.r2UploadStatus || 'already-uploaded',
            manifestStatus: 'pending',
            contentHash: item.contentHash,
            rev: item.rev,
            processedAt: nowIso()
          };
          skippedUploads += 1;
          continue;
        }

        const existing = assetMap[item.assetKey];
        const shouldUpload = !(existing?.assetVersion === item.assetVersion && existing?.r2ObjectKey === item.r2ObjectKey && await headR2Object(item.r2ObjectKey));

        if (shouldUpload) {
          const buffer = await downloadDropboxFile(item.source, { dropboxClient });
          await putR2Object({
            objectKey: item.r2ObjectKey,
            body: buffer,
            contentType: item.contentType,
            contentLength: buffer.length,
            metadata: {
              'dropbox-rev': item.rev || '',
              'asset-version': item.assetVersion || ''
            }
          });
          uploadedToR2 += 1;
          console.log(`[asset-sync] r2-uploaded key=${item.r2ObjectKey}`);
        } else {
          skippedUploads += 1;
        }

        addManifestAsset(assetMap, item, {
          updatedAt: nowIso()
        });
        uploadedItems.push(item);
        fileStates[item.source] = {
          originalDropboxPath: item.source,
          organizedDropboxPath: item.dropboxDestination,
          category: item.category,
          assetKey: item.assetKey,
          r2ObjectKey: item.r2ObjectKey,
          url: item.url,
          dropboxMoveStatus: item.source === item.dropboxDestination ? 'not-required' : 'pending',
          r2UploadStatus: shouldUpload ? 'uploaded' : 'skipped',
          manifestStatus: 'pending',
          contentHash: item.contentHash,
          rev: item.rev,
          processedAt: nowIso()
        };
      } catch (error) {
        failedItems.push({ item, error: getErrorSummary(error) });
        fileStates[item.source] = {
          ...(fileStates[item.source] || {}),
          originalDropboxPath: item.source,
          organizedDropboxPath: item.dropboxDestination,
          category: item.category,
          assetKey: item.assetKey,
          r2ObjectKey: item.r2ObjectKey,
          r2UploadStatus: 'failed',
          manifestStatus: 'skipped',
          dropboxMoveStatus: 'not-moved',
          error: getErrorSummary(error),
          processedAt: nowIso()
        };
        console.error(`[asset-sync] r2-upload-failed key=${item.r2ObjectKey} error="${getErrorSummary(error).message}"`);
      }
    }

    const manifest = createAssetManifest(assetMap, 'dropbox-latest-to-r2');
    const writtenManifest = await writeDiskManifest(manifest);
    cachedManifest = writtenManifest;
    for (const item of uploadedItems) {
      fileStates[item.source] = {
        ...fileStates[item.source],
        manifestStatus: 'written'
      };
    }
    console.log(`[asset-sync] manifest-written assets=${writtenManifest.assetCount}`);

    let movedInDropbox = 0;
    let requiresCleanup = 0;
    for (const item of uploadedItems) {
      if (
        item.source === item.dropboxDestination ||
        !item.action.includes('move-dropbox-file')
      ) {
        fileStates[item.source] = {
          ...fileStates[item.source],
          dropboxMoveStatus: 'not-required',
          error: null
        };
        continue;
      }

      try {
        await moveDropboxFile(item.source, item.dropboxDestination, { dropboxClient });
        movedInDropbox += 1;
        fileStates[item.source] = {
          ...fileStates[item.source],
          dropboxMoveStatus: 'moved',
          status: 'moved',
          error: null
        };
      } catch (error) {
        if (isDropboxFromLookupNotFoundError(error) && await fileExists(item.dropboxDestination, { dropboxClient })) {
          movedInDropbox += 1;
          fileStates[item.source] = {
            ...fileStates[item.source],
            dropboxMoveStatus: 'moved',
            status: 'moved',
            error: null,
            reconciledAt: nowIso(),
            reconciliationReason: 'source-missing-destination-exists'
          };
          console.log(`[asset-sync] dropbox-move-reconciled source=${item.source} to=${item.dropboxDestination}`);
          continue;
        }

        requiresCleanup += 1;
        fileStates[item.source] = {
          ...fileStates[item.source],
          dropboxMoveStatus: 'requires-cleanup',
          status: 'requires-cleanup',
          error: getErrorSummary(error)
        };
        console.error(`[asset-sync] dropbox-move-failed from=${item.source} to=${item.dropboxDestination} error="${getErrorSummary(error).message}"`);
      }
    }

    for (const stale of plan.staleR2Deletes) {
      if (stale.blocked) {
        console.log(`[asset-sync] r2-delete-blocked key=${stale.r2ObjectKey} reason=${stale.reason}`);
        continue;
      }

      await deleteR2Object(stale.r2ObjectKey);
      deletedFromR2 += 1;
      console.log(`[asset-sync] r2-deleted key=${stale.r2ObjectKey}`);
    }

    const r2Keys = Object.values(writtenManifest.assets).map((asset) => asset.r2ObjectKey || asset.r2Key).filter(Boolean);
    const finishedAt = nowIso();
    const report = {
      ok: failedItems.length === 0,
      startedAt,
      finishedAt,
      durationMs: Date.now() - startedMs,
      discovered: plan.counts.discovered,
      uploadedToR2,
      movedInDropbox,
      skipped: plan.skipped.length + skippedUploads,
      failed: failedItems.length,
      requiresCleanup,
      deletedFromR2,
      blockedR2Deletes: plan.staleR2Deletes.filter((item) => item.blocked).length,
      fingerprint: plan.fingerprint,
      manifestGeneratedAt: writtenManifest.generatedAt,
      plan
    };

    const nextState = {
      ...state,
      lastSyncAt: finishedAt,
      lastSuccessfulSyncAt: failedItems.length === 0 ? finishedAt : state.lastSuccessfulSyncAt,
      firstRealSyncCompletedAt: state.firstRealSyncCompletedAt || finishedAt,
      files: fileStates,
      r2Keys,
      managedR2Keys: r2Keys,
      deletedR2Keys: plan.staleR2Deletes
        .filter((item) => !item.blocked)
        .map((item) => item.r2ObjectKey),
      lastCounts: report
    };
    await writeSyncState(nextState);
    lastSyncReport = report;
    lastError = failedItems.length ? { name: 'AssetSyncPartialFailure', message: `${failedItems.length} file(s) failed.` } : null;
    console.log(`[asset-sync] sync-complete durationMs=${report.durationMs} uploaded=${uploadedToR2} moved=${movedInDropbox} failed=${failedItems.length} cleanup=${requiresCleanup}`);
    return report;
  } catch (error) {
    lastError = getErrorSummary(error);
    console.error(`[asset-sync] sync-failed error="${lastError.message}"`);
    throw error;
  } finally {
    syncInProgress = false;
  }
}

async function getCachedManifest(options = {}) {
  if (cachedManifest && !options.forceDisk) return cachedManifest;
  cachedManifest = await readDiskManifest({ allowMissing: true });
  return cachedManifest;
}

function setCachedManifest(manifest) {
  cachedManifest = manifest;
}

async function getLatestCursor(dropboxClient, folderPath = getSyncConfig().latestPath) {
  const response = await dropboxClient.filesListFolderGetLatestCursor({
    path: folderPath,
    recursive: true,
    include_deleted: false,
    include_non_downloadable_files: false
  });
  return response.result.cursor;
}

async function checkDropboxPathChanges(watchedPath, options = {}) {
  const dropboxClient = options.dropboxClient || createDropboxClient();
  if (!dropboxClient) throw new Error('Dropbox refresh token is not configured.');

  const state = await readSyncState();
  const cursorKey = watchedPath.key;
  const previousCursor =
    state.dropboxCursors[cursorKey] ||
    (cursorKey === 'latest' ? state.dropboxCursor : null);

  if (!previousCursor) {
    const latestEntries = await listDropboxEntries(dropboxClient, watchedPath.path).catch((error) => {
      if (isDropboxNotFoundError(error)) return [];
      throw error;
    });
    const cursor = await getLatestCursor(dropboxClient, watchedPath.path);
    await writeSyncState({
      ...state,
      dropboxCursor: cursorKey === 'latest' ? cursor : state.dropboxCursor,
      dropboxCursors: {
        ...state.dropboxCursors,
        [cursorKey]: cursor
      },
      latestInboxInspectedAt: nowIso()
    });
    return latestEntries.some(isFileEntry);
  }

  try {
    const response = await dropboxClient.filesListFolderContinue({ cursor: previousCursor });
    await writeSyncState({
      ...state,
      dropboxCursor: cursorKey === 'latest' ? response.result.cursor : state.dropboxCursor,
      dropboxCursors: {
        ...state.dropboxCursors,
        [cursorKey]: response.result.cursor
      }
    });
    return response.result.entries.length > 0;
  } catch (error) {
    if (!isDropboxCursorResetError(error)) throw error;

    const cursor = await getLatestCursor(dropboxClient, watchedPath.path);
    await writeSyncState({
      ...state,
      dropboxCursor: cursorKey === 'latest' ? cursor : state.dropboxCursor,
      dropboxCursors: {
        ...state.dropboxCursors,
        [cursorKey]: cursor
      },
      latestInboxInspectedAt: nowIso()
    });
    console.warn(`[asset-sync] dropbox-cursor-reset path=${watchedPath.path} forcing-full-plan-on-next-run`);
    return true;
  }
}

async function checkDropboxManagedChanges(options = {}) {
  const syncConfig = getSyncConfig();
  const dropboxClient = options.dropboxClient || createDropboxClient();
  if (!dropboxClient) throw new Error('Dropbox refresh token is not configured.');

  let changed = false;
  const changedPaths = [];
  for (const watchedPath of getWatchedDropboxPaths(syncConfig)) {
    const pathChanged = await checkDropboxPathChanges(watchedPath, { dropboxClient });
    changed = changed || pathChanged;
    if (pathChanged) changedPaths.push(watchedPath.path);
  }

  return { changed, changedPaths };
}

async function checkDropboxLatestChanges(options = {}) {
  return checkDropboxPathChanges(getWatchedDropboxPaths()[0], options);
}

function getSetupStatus(manifest = cachedManifest) {
  const syncConfig = getSyncConfig();
  const r2Status = getR2ConfigStatus();
  const missingConfig = getMissingConfig();
  const state = readSyncStateSnapshot();
  return {
    ok: missingConfig.length === 0,
    dropbox: {
      configured: Boolean(process.env.DROPBOX_REFRESH_TOKEN),
      latestPath: syncConfig.latestPath,
      assetsRoot: syncConfig.assetsRoot,
      reorganizeEnabled: syncConfig.reorganizeEnabled
    },
    r2: {
      configured: r2Status.configured,
      bucketName: r2Status.bucket,
      assetPrefix: r2Status.assetPrefix,
      publicBaseUrl: r2Status.publicBaseUrl,
      bucketReachable: r2Status.bucketReachable,
      bucketLookupMethod: r2Status.bucketLookupMethod,
      bucketLookupError: r2Status.bucketLookupError
    },
    sync: {
      enabled: syncConfig.enabled,
      onBoot: syncConfig.onBoot,
      cron: syncConfig.cron,
      running: syncInProgress,
      scheduler: {
        enabled: schedulerState.enabled,
        startedAt: schedulerState.startedAt,
        cron: schedulerState.cron,
        watchedPaths: schedulerState.watchedPaths,
        lastRunStartedAt: schedulerState.lastRunStartedAt,
        lastRunCompletedAt: schedulerState.lastRunCompletedAt,
        lastChangeCheckAt: schedulerState.lastChangeCheckAt,
        lastSyncStartedAt: schedulerState.lastSyncStartedAt,
        lastSyncCompletedAt: schedulerState.lastSyncCompletedAt,
        lastSkippedReason: schedulerState.lastSkippedReason
      },
      readyForFirstRealSync: Boolean(
        missingConfig.length === 0 &&
          r2Status.configured &&
          r2Status.bucketReachable === true &&
          state.lastDryRunSource === 'api' &&
          state.lastDryRunOk === true
      ),
      firstRealSyncCompletedAt: state.firstRealSyncCompletedAt,
      lastDryRunCompletedAt: state.lastDryRunCompletedAt,
      lastDryRunSource: state.lastDryRunSource,
      lastDryRunOk: state.lastDryRunOk,
      lastDryRunFingerprint: state.lastDryRunFingerprint,
      managedR2KeyCount: state.managedR2Keys.length,
      lastReport: lastSyncReport
    },
    manifest: {
      exists: Boolean(manifest?.generatedAt),
      generatedAt: manifest?.generatedAt || null,
      assetCount: manifest?.assetCount || 0
    },
    missingConfig,
    lastError
  };
}

async function runScheduledAssetSync(options = {}) {
  schedulerState.lastRunStartedAt = nowIso();
  schedulerState.lastRunCompletedAt = null;

  if (options.syncInProgress ?? syncInProgress) {
    schedulerState.lastSkippedReason = 'already-running';
    schedulerState.lastRunCompletedAt = nowIso();
    console.log('[asset-sync] scheduled-sync-skipped reason=already-running');
    return { skipped: true, reason: 'already-running' };
  }

  try {
    schedulerState.lastChangeCheckAt = nowIso();
    const changes = options.checkChanges ? await options.checkChanges() : await checkDropboxManagedChanges(options);
    if (!changes.changed) {
      schedulerState.lastSkippedReason = 'no-dropbox-changes';
      schedulerState.lastRunCompletedAt = nowIso();
      return { skipped: true, reason: 'no-dropbox-changes', changedPaths: [] };
    }

    schedulerState.lastSkippedReason = null;
    schedulerState.lastSyncStartedAt = nowIso();
    const report = options.runSync ? await options.runSync() : await runTrustedAssetSync({
      source: 'scheduler',
      reason: 'scheduled-sync'
    });
    schedulerState.lastSyncCompletedAt = nowIso();
    schedulerState.lastRunCompletedAt = schedulerState.lastSyncCompletedAt;
    return { skipped: false, changedPaths: changes.changedPaths, report };
  } catch (error) {
    lastError = getErrorSummary(error);
    schedulerState.lastSkippedReason = 'sync-failed';
    schedulerState.lastRunCompletedAt = nowIso();
    console.error(`[asset-sync] scheduled-sync-failed error="${lastError.message}"`);
    throw error;
  }
}

function startAssetScheduler() {
  const syncConfig = getSyncConfig();
  schedulerState.cron = syncConfig.cron;
  schedulerState.watchedPaths = getWatchedDropboxPaths(syncConfig).map((watchedPath) => watchedPath.path);

  if (!syncConfig.enabled || !isR2Configured()) {
    schedulerState.enabled = false;
    schedulerState.lastSkippedReason = 'config-or-env';
    console.warn('[asset-sync] scheduler-disabled reason=config-or-env');
    return null;
  }

  if (scheduledTask) return scheduledTask;
  if (!cron.validate(syncConfig.cron)) {
    schedulerState.enabled = false;
    schedulerState.lastSkippedReason = 'invalid-cron';
    console.warn(`[asset-sync] scheduler-disabled reason=invalid-cron cron="${syncConfig.cron}"`);
    return null;
  }

  scheduledTask = cron.schedule(syncConfig.cron, async () => {
    await runScheduledAssetSync().catch(() => {});
  });

  schedulerState.enabled = true;
  schedulerState.startedAt = nowIso();
  schedulerState.lastSkippedReason = null;
  console.log(`[asset-sync] scheduler-started cron="${syncConfig.cron}"`);
  return scheduledTask;
}

function stopAssetScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
  schedulerState.enabled = false;
}

module.exports = {
  SYNC_STATE_PATH: DEFAULT_SYNC_STATE_PATH,
  buildAssetSyncPlan,
  checkDropboxManagedChanges,
  checkDropboxLatestChanges,
  checkDropboxPathChanges,
  createDropboxClient,
  createPlanFingerprint,
  downloadDropboxFile,
  ensureDropboxFolder,
  executeAssetSync,
  fileExists,
  getCachedManifest,
  getDropboxFileMetadata,
  getErrorSummary,
  getMissingConfig,
  getOrganizedAssetSyncAction,
  getSetupStatus,
  getSyncConfig,
  getSyncStatePath,
  getWatchedDropboxPaths,
  getCleanupRetryItems,
  isDropboxFolderConflictError,
  isDropboxFromLookupNotFoundError,
  isR2Configured,
  listFilesRecursive,
  listLatestAssets,
  moveDropboxFile,
  readSyncState,
  recordDryRun,
  runScheduledAssetSync,
  runTrustedAssetSync,
  sanitizeErrorMessage,
  setCachedManifest,
  startAssetScheduler,
  stopAssetScheduler,
  writeSyncState
};
