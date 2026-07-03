const {
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} = require('@aws-sdk/client-s3');

const DEFAULT_ASSET_PREFIX = 'site-assets';
const PUBLIC_CACHE_CONTROL = 'public, max-age=31536000, immutable';

let cachedClient = null;
let lastBucketLookup = null;

function getR2Config() {
  const assetPrefix = (process.env.R2_ASSET_PREFIX || DEFAULT_ASSET_PREFIX).replace(/^\/+|\/+$/g, '');

  return {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucket: process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || '',
    publicBaseUrl: (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/g, ''),
    assetPrefix
  };
}

function isR2Configured() {
  const config = getR2Config();
  return Boolean(
    config.accountId &&
      config.accessKeyId &&
      config.secretAccessKey &&
      config.bucket &&
      config.publicBaseUrl
  );
}

function getR2ConfigStatus() {
  const config = getR2Config();

  return {
    configured: isR2Configured(),
    hasAccountId: Boolean(config.accountId),
    hasAccessKeyId: Boolean(config.accessKeyId),
    hasSecretAccessKey: Boolean(config.secretAccessKey),
    bucket: config.bucket || null,
    publicBaseUrl: config.publicBaseUrl || null,
    assetPrefix: config.assetPrefix,
    bucketReachable: lastBucketLookup?.bucketReachable ?? null,
    bucketLookupMethod: lastBucketLookup?.bucketLookupMethod || null,
    bucketLookupError: lastBucketLookup?.bucketLookupError || null
  };
}

function createR2Client() {
  const config = getR2Config();

  if (!isR2Configured()) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }

  return cachedClient;
}

function getPublicR2Url(objectKey, assetVersion) {
  const { publicBaseUrl } = getR2Config();
  const url = `${publicBaseUrl}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;

  if (!assetVersion) {
    return url;
  }

  return `${url}?v=${encodeURIComponent(assetVersion)}`;
}

function getR2ErrorStatus(error) {
  return error?.$metadata?.httpStatusCode || error?.statusCode || error?.status || null;
}

function getR2ErrorCode(error) {
  return error?.name || error?.Code || error?.code || error?.__type || null;
}

function summarizeR2Error(error) {
  return {
    name: getR2ErrorCode(error) || 'Error',
    message: String(error?.message || 'Unknown Cloudflare R2 error.'),
    status: getR2ErrorStatus(error)
  };
}

function isNoSuchBucketError(error) {
  const code = String(getR2ErrorCode(error) || '');
  const message = String(error?.message || '');
  return getR2ErrorStatus(error) === 404 || /NoSuchBucket/i.test(code) || /bucket.*does not exist/i.test(message);
}

function isPermissionError(error) {
  const code = String(getR2ErrorCode(error) || '');
  const status = getR2ErrorStatus(error);
  return status === 401 || status === 403 || /AccessDenied|Forbidden|Unauthorized/i.test(code);
}

function createBucketLookupError(config, headError, listError, bucketNames = []) {
  const accountLabel = config.accountId || '<missing>';
  const bucketLabel = config.bucket || '<missing>';

  if (isNoSuchBucketError(headError)) {
    return {
      code: 'r2_bucket_not_found',
      message:
        `Express could not locate R2_BUCKET_NAME="${bucketLabel}" in R2 account "${accountLabel}". ` +
        'No bucket was created. Verify R2_BUCKET_NAME, R2_ACCOUNT_ID, and the R2 credentials, or set R2_BUCKET_NAME to the existing bucket.',
      headBucketError: summarizeR2Error(headError),
      listBucketsError: listError ? summarizeR2Error(listError) : null,
      candidateBuckets: bucketNames
    };
  }

  if (listError && isPermissionError(listError)) {
    return {
      code: 'r2_bucket_lookup_forbidden',
      message:
        `Express could not verify R2_BUCKET_NAME="${bucketLabel}" in R2 account "${accountLabel}". ` +
        'HeadBucket failed and ListBuckets was denied by the current credentials. No bucket was created. Verify the bucket policy, token scope, account, and bucket name.',
      headBucketError: headError ? summarizeR2Error(headError) : null,
      listBucketsError: summarizeR2Error(listError),
      candidateBuckets: []
    };
  }

  return {
    code: 'r2_bucket_lookup_failed',
    message:
      `Express could not verify R2_BUCKET_NAME="${bucketLabel}" in R2 account "${accountLabel}". ` +
      'No bucket was created. Verify R2_BUCKET_NAME, R2_ACCOUNT_ID, and the R2 credentials.',
    headBucketError: headError ? summarizeR2Error(headError) : null,
    listBucketsError: listError ? summarizeR2Error(listError) : null,
    candidateBuckets: bucketNames
  };
}

async function verifyR2Bucket(options = {}) {
  const config = options.config || getR2Config();
  const client = options.client || createR2Client();
  const result = {
    configured: isR2Configured(),
    bucket: config.bucket || null,
    accountId: config.accountId || null,
    accountIdPrefix: config.accountId ? `${config.accountId.slice(0, 5)}...` : null,
    publicBaseUrl: config.publicBaseUrl || null,
    bucketReachable: false,
    bucketLookupMethod: null,
    headBucketRan: false,
    listBucketsRan: false,
    candidateBuckets: [],
    bucketLookupError: null
  };

  if (!client) {
    result.bucketLookupError = {
      code: 'r2_not_configured',
      message: 'Cloudflare R2 is not fully configured. No bucket lookup was attempted.'
    };
    lastBucketLookup = result;
    return result;
  }

  let headError = null;

  try {
    result.headBucketRan = true;
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
    result.bucketReachable = true;
    result.bucketLookupMethod = 'head-bucket';
    lastBucketLookup = result;
    return result;
  } catch (error) {
    headError = error;
  }

  let listError = null;
  try {
    result.listBucketsRan = true;
    const response = await client.send(new ListBucketsCommand({}));
    result.candidateBuckets = (response.Buckets || [])
      .map((bucket) => bucket.Name)
      .filter(Boolean)
      .sort();

    if (result.candidateBuckets.includes(config.bucket)) {
      result.bucketReachable = true;
      result.bucketLookupMethod = 'list-buckets';
      result.bucketLookupError = {
        code: 'r2_head_bucket_failed_but_listed',
        message:
          `HeadBucket failed for R2_BUCKET_NAME="${config.bucket}", but ListBuckets found an exact bucket-name match. ` +
          'Express will continue using the configured bucket and no bucket was created.',
        headBucketError: summarizeR2Error(headError)
      };
      lastBucketLookup = result;
      return result;
    }
  } catch (error) {
    listError = error;
  }

  result.bucketLookupMethod = result.listBucketsRan ? 'head-bucket-and-list-buckets' : 'head-bucket';
  result.bucketLookupError = createBucketLookupError(
    config,
    headError,
    listError,
    result.candidateBuckets
  );
  lastBucketLookup = result;
  return result;
}

async function headR2Object(objectKey) {
  const client = createR2Client();
  if (!client) throw new Error('Cloudflare R2 is not configured.');

  try {
    return await client.send(
      new HeadObjectCommand({
        Bucket: getR2Config().bucket,
        Key: objectKey
      })
    );
  } catch (error) {
    const statusCode = error?.$metadata?.httpStatusCode || error?.statusCode;
    if (statusCode === 404 || error?.name === 'NotFound') {
      return null;
    }
    throw error;
  }
}

async function putR2Object({ objectKey, body, contentType, contentLength, metadata = {}, dryRun = false }) {
  if (dryRun) {
    return { dryRun: true };
  }

  const client = createR2Client();
  if (!client) throw new Error('Cloudflare R2 is not configured.');

  return client.send(
    new PutObjectCommand({
      Bucket: getR2Config().bucket,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
      ContentLength: contentLength,
      CacheControl: PUBLIC_CACHE_CONTROL,
      Metadata: metadata
    })
  );
}

async function uploadAssetToR2({ buffer, stream, objectKey, contentType, cacheControl, metadata = {} }) {
  const client = createR2Client();
  if (!client) throw new Error('Cloudflare R2 is not configured.');

  return client.send(
    new PutObjectCommand({
      Bucket: getR2Config().bucket,
      Key: objectKey,
      Body: stream || buffer,
      ContentType: contentType,
      ContentLength: buffer?.length,
      CacheControl: cacheControl || PUBLIC_CACHE_CONTROL,
      Metadata: metadata
    })
  );
}

async function deleteR2Object(objectKey, options = {}) {
  if (options.dryRun) {
    return { dryRun: true };
  }

  const client = createR2Client();
  if (!client) throw new Error('Cloudflare R2 is not configured.');

  return client.send(
    new DeleteObjectCommand({
      Bucket: getR2Config().bucket,
      Key: objectKey
    })
  );
}

async function listR2ObjectKeys(prefix = getR2Config().assetPrefix) {
  const client = createR2Client();
  if (!client) throw new Error('Cloudflare R2 is not configured.');

  const keys = [];
  let continuationToken;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: getR2Config().bucket,
        Prefix: prefix ? `${prefix.replace(/\/+$/g, '')}/` : undefined,
        ContinuationToken: continuationToken
      })
    );

    for (const item of response.Contents || []) {
      if (item.Key) keys.push(item.Key);
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return keys;
}

module.exports = {
  PUBLIC_CACHE_CONTROL,
  deleteR2Object,
  getPublicR2Url,
  getPublicUrl: getPublicR2Url,
  getR2Config,
  getR2ConfigStatus,
  headR2Object,
  isR2Configured,
  listR2ObjectKeys,
  objectExists: headR2Object,
  uploadAssetToR2,
  putR2Object,
  verifyR2Bucket
};
