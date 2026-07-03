const assert = require('node:assert/strict');
const test = require('node:test');

function withEnv(overrides, run) {
  const original = {};
  for (const key of Object.keys(overrides)) {
    original[key] = process.env[key];
    process.env[key] = overrides[key];
  }

  const restore = () => {
    for (const key of Object.keys(overrides)) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  };

  try {
    const result = run();
    if (result && typeof result.then === 'function') {
      return result.finally(restore);
    }
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

test('reports R2 configuration status without exposing secrets', () => {
  withEnv(
    {
      R2_ACCOUNT_ID: 'account',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET: 'bucket',
      R2_PUBLIC_BASE_URL: 'https://assets.example.com/',
      R2_ASSET_PREFIX: 'media'
    },
    () => {
      const { getR2ConfigStatus } = require('./r2');
      assert.deepEqual(getR2ConfigStatus(), {
        configured: true,
        hasAccountId: true,
        hasAccessKeyId: true,
        hasSecretAccessKey: true,
        bucket: 'bucket',
        publicBaseUrl: 'https://assets.example.com',
        assetPrefix: 'media',
        bucketReachable: null,
        bucketLookupMethod: null,
        bucketLookupError: null
      });
    }
  );
});

test('builds public R2 URLs with encoded path segments and asset versions', () => {
  withEnv(
    {
      R2_ACCOUNT_ID: 'account',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET: 'bucket',
      R2_PUBLIC_BASE_URL: 'https://assets.example.com'
    },
    () => {
      const { getPublicR2Url } = require('./r2');
      assert.equal(
        getPublicR2Url('assets/results/competition/client comp.jpg', 'rev:hash'),
        'https://assets.example.com/assets/results/competition/client%20comp.jpg?v=rev%3Ahash'
      );
    }
  );
});

function createR2Error(name, message, status) {
  const error = new Error(message);
  error.name = name;
  error.$metadata = { httpStatusCode: status };
  return error;
}

function createFakeClient(handler) {
  const commands = [];
  return {
    commands,
    async send(command) {
      commands.push(command.constructor.name);
      return handler(command.constructor.name, command);
    }
  };
}

const LOOKUP_ENV = {
  R2_ACCOUNT_ID: 'd3e7e7f4a642f016210bf1611abf6226',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET_NAME: 'jake-site-assets',
  R2_PUBLIC_BASE_URL: 'https://jake-site-assets.akhileshboda.com'
};

test('R2 bucket preflight succeeds with exact HeadBucket match', async () => {
  await withEnv(LOOKUP_ENV, async () => {
    const fakeClient = createFakeClient(async (commandName) => {
      assert.equal(commandName, 'HeadBucketCommand');
      return {};
    });
    const { verifyR2Bucket } = require('./r2');
    const result = await verifyR2Bucket({ client: fakeClient });

    assert.equal(result.bucketReachable, true);
    assert.equal(result.bucketLookupMethod, 'head-bucket');
    assert.equal(result.headBucketRan, true);
    assert.equal(result.listBucketsRan, false);
    assert.equal(fakeClient.commands.includes('CreateBucketCommand'), false);
  });
});

test('R2 bucket preflight reports missing configured bucket without creating it', async () => {
  await withEnv(LOOKUP_ENV, async () => {
    const fakeClient = createFakeClient(async (commandName) => {
      if (commandName === 'HeadBucketCommand') {
        throw createR2Error('NoSuchBucket', 'The specified bucket does not exist.', 404);
      }
      if (commandName === 'ListBucketsCommand') {
        return { Buckets: [{ Name: 'other-bucket' }] };
      }
      throw new Error(`Unexpected command: ${commandName}`);
    });
    const { verifyR2Bucket } = require('./r2');
    const result = await verifyR2Bucket({ client: fakeClient });

    assert.equal(result.bucketReachable, false);
    assert.equal(result.bucketLookupError.code, 'r2_bucket_not_found');
    assert.match(result.bucketLookupError.message, /R2_BUCKET_NAME="jake-site-assets"/);
    assert.match(result.bucketLookupError.message, /R2 account "d3e7e7f4a642f016210bf1611abf6226"/);
    assert.match(result.bucketLookupError.message, /No bucket was created/);
    assert.deepEqual(result.candidateBuckets, ['other-bucket']);
    assert.equal(fakeClient.commands.includes('CreateBucketCommand'), false);
  });
});

test('R2 bucket preflight accepts exact ListBuckets match after HeadBucket failure', async () => {
  await withEnv(LOOKUP_ENV, async () => {
    const fakeClient = createFakeClient(async (commandName) => {
      if (commandName === 'HeadBucketCommand') {
        throw createR2Error('Forbidden', 'Head bucket is forbidden.', 403);
      }
      if (commandName === 'ListBucketsCommand') {
        return { Buckets: [{ Name: 'jake-site-assets' }, { Name: 'archive' }] };
      }
      throw new Error(`Unexpected command: ${commandName}`);
    });
    const { verifyR2Bucket } = require('./r2');
    const result = await verifyR2Bucket({ client: fakeClient });

    assert.equal(result.bucketReachable, true);
    assert.equal(result.bucketLookupMethod, 'list-buckets');
    assert.equal(result.bucketLookupError.code, 'r2_head_bucket_failed_but_listed');
    assert.deepEqual(result.candidateBuckets, ['archive', 'jake-site-assets']);
    assert.equal(fakeClient.commands.includes('CreateBucketCommand'), false);
  });
});

test('R2 bucket preflight reports denied lookup clearly', async () => {
  await withEnv(LOOKUP_ENV, async () => {
    const fakeClient = createFakeClient(async (commandName) => {
      if (commandName === 'HeadBucketCommand') {
        throw createR2Error('Forbidden', 'Head bucket is forbidden.', 403);
      }
      if (commandName === 'ListBucketsCommand') {
        throw createR2Error('AccessDenied', 'List buckets is denied.', 403);
      }
      throw new Error(`Unexpected command: ${commandName}`);
    });
    const { verifyR2Bucket } = require('./r2');
    const result = await verifyR2Bucket({ client: fakeClient });

    assert.equal(result.bucketReachable, false);
    assert.equal(result.bucketLookupError.code, 'r2_bucket_lookup_forbidden');
    assert.match(result.bucketLookupError.message, /could not verify/);
    assert.match(result.bucketLookupError.message, /No bucket was created/);
    assert.equal(result.headBucketRan, true);
    assert.equal(result.listBucketsRan, true);
    assert.equal(fakeClient.commands.includes('CreateBucketCommand'), false);
  });
});
