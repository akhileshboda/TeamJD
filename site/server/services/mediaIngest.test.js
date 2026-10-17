const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const test = require('node:test');
const sharp = require('sharp');
const ingest = require('./mediaIngest');
const { createRebuildPurgeDeletes } = require('./assetSync');

const STORAGE_ENV = {
  R2_ACCOUNT_ID: 'acct', R2_ACCESS_KEY_ID: 'key', R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET_NAME: 'bucket', R2_PUBLIC_BASE_URL: 'https://cdn.example', R2_ASSET_PREFIX: 'site-assets',
  DROPBOX_REFRESH_TOKEN: 'token', NODE_ENV: 'test'
};
Object.assign(process.env, STORAGE_ENV);
delete process.env.R2_CMS_PREFIX;
delete process.env.APP_ENV;

const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
})();

function fakeStorage({ dropbox = 'ok' } = {}) {
  const writes = { dropbox: [], r2: [] };
  return {
    writes,
    async putDropbox(dropboxPath, { buffer, filePath }) {
      if (dropbox === 'missing') return null;
      if (dropbox === 'failing') throw new Error('Dropbox is down');
      writes.dropbox.push({ dropboxPath, bytes: buffer ? buffer.length : (await fs.stat(filePath)).size });
      return {};
    },
    async putR2({ objectKey, buffer, filePath, contentType }) {
      const body = buffer || (await fs.readFile(filePath));
      writes.r2.push({ objectKey, contentType, body });
    }
  };
}

async function uploadFile(fileName, buffer) {
  const { uploadId } = ingest.createUploadSession({ fileName, size: buffer.length, uploadedBy: 'jake@test' });
  await ingest.appendChunk(uploadId, 0, Readable.from([buffer]));
  return uploadId;
}

async function sessionFor(kind, fileName, buffer) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ingest-'));
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, buffer);
  return { kind, filePath, size: buffer.length, uploadedBy: 'jake@test', originalName: fileName };
}

test('the kind comes from the file, and bad files are refused up front', () => {
  const attempt = (fileName, size) => () => ingest.createUploadSession({ fileName, size });
  assert.equal(ingest.createUploadSession({ fileName: 'a.JPG', size: 10 }).kind, 'image');
  assert.equal(ingest.createUploadSession({ fileName: 'b.mov', size: 10 }).kind, 'video');
  assert.throws(attempt('IMG_0001.HEIC', 1000), { statusCode: 415, message: /HEIC/ });
  assert.throws(attempt('notes.pdf', 1000), { statusCode: 415, message: /JPG/ });
  assert.throws(attempt('photo.jpg', 0), { statusCode: 400 });
  assert.throws(attempt('photo.jpg', ingest.MAX_BYTES.image + 1), { statusCode: 413 });
});

test('library files live under cms/<environment>, never inside the sync prefix', () => {
  assert.equal(ingest.getCmsPrefix(), 'cms/test');
  assert.equal(ingest.cmsPrefixIsSafe('cms/test', 'site-assets'), true);
  assert.equal(ingest.cmsPrefixIsSafe('site-assets/test', 'site-assets'), false);
  assert.equal(ingest.cmsPrefixIsSafe('cms/test', ''), false, 'an empty sync prefix would mean the whole bucket');

  process.env.R2_CMS_PREFIX = 'site-assets';
  try {
    assert.throws(() => ingest.createUploadSession({ fileName: 'a.jpg', size: 10 }), { statusCode: 503 });
  } finally {
    delete process.env.R2_CMS_PREFIX;
  }
});

test('the asset sync never deletes library files', () => {
  // The sync's purge only considers keys under its own prefix.
  const deletes = createRebuildPurgeDeletes(['cms/production/abc.webp', 'site-assets/about/old.webp'], 'site-assets');
  assert.deepEqual(deletes.map((item) => item.r2ObjectKey || item), ['site-assets/about/old.webp']);
});

test('chunks must arrive in order, and a retried chunk does not double-append', async () => {
  const { uploadId } = ingest.createUploadSession({ fileName: 'a.jpg', size: 6 });
  await assert.rejects(ingest.appendChunk(uploadId, 1, Readable.from([Buffer.from('xyz')])), { statusCode: 409 });
  await ingest.appendChunk(uploadId, 0, Readable.from([Buffer.from('abc')]));
  await assert.rejects(ingest.appendChunk(uploadId, 1, Readable.from([Buffer.from('defgh')])), { statusCode: 413 });
  const { received } = await ingest.appendChunk(uploadId, 1, Readable.from([Buffer.from('def')]));
  assert.equal(received, 6);
});

test('a photo becomes a WebP library asset with its original backed up to Dropbox', async () => {
  const photo = await sharp({ create: { width: 3200, height: 2000, channels: 3, background: '#335566' } }).jpeg().toBuffer();
  const storage = fakeStorage();
  const asset = await ingest.processUpload(await sessionFor('image', 'portrait.jpg', photo), { storage, now: new Date('2026-10-18T00:00:00Z') });

  assert.match(asset.id, /^[0-9a-f-]{36}$/);
  assert.equal(asset.kind, 'image');
  assert.equal(asset.width, 2400);
  assert.equal(asset.backup, 'done');
  assert.equal(asset.uploadedAt, '2026-10-18T00:00:00.000Z');
  assert.deepEqual(asset.r2Keys, [`cms/test/${asset.id}.webp`]);
  assert.equal(asset.url, `https://cdn.example/cms/test/${asset.id}.webp`);
  assert.deepEqual(storage.writes.dropbox.map((w) => w.dropboxPath), [`/cms-backup/test/media/${asset.id}-portrait.jpg`]);
  const [r2] = storage.writes.r2;
  assert.equal(r2.contentType, 'image/webp');
  assert.equal((await sharp(r2.body).metadata()).format, 'webp');
});

test('uploads still work when Dropbox is missing or failing', async () => {
  const photo = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#000' } }).png().toBuffer();
  const missing = await ingest.processUpload(await sessionFor('image', 'a.png', photo), { storage: fakeStorage({ dropbox: 'missing' }) });
  assert.equal(missing.backup, 'skipped');
  const failing = await ingest.processUpload(await sessionFor('image', 'b.png', photo), { storage: fakeStorage({ dropbox: 'failing' }) });
  assert.equal(failing.backup, 'failed');
});

test('a file that is not really a photo is rejected without writing anything', async () => {
  const storage = fakeStorage();
  const session = await sessionFor('image', 'fake.jpg', Buffer.from('definitely not a jpeg'));
  await assert.rejects(ingest.processUpload(session, { storage }), { statusCode: 400, message: /not a photo/ });
  assert.equal(storage.writes.dropbox.length + storage.writes.r2.length, 0);
});

test('a video is transcoded to web MP4 with a poster', { skip: !hasFfmpeg && 'ffmpeg not installed' }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ingest-video-'));
  const source = path.join(dir, 'clip.mov');
  execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc=size=2560x1440:rate=30', '-f', 'lavfi', '-i', 'sine',
    '-t', '2', '-c:v', 'libx264', '-c:a', 'aac', '-shortest', source], { stdio: 'ignore' });
  const buffer = await fs.readFile(source);
  const storage = fakeStorage();
  const asset = await ingest.processUpload(await sessionFor('video', 'clip.mov', buffer), { storage });

  assert.deepEqual(storage.writes.r2.map((w) => w.contentType), ['video/mp4', 'image/webp']);
  assert.deepEqual(asset.r2Keys, [`cms/test/${asset.id}.mp4`, `cms/test/${asset.id}-poster.webp`]);
  assert.match(asset.posterUrl, /-poster\.webp$/);
  assert.equal(asset.width, 1920);
  assert.equal(asset.backup, 'done');

  const out = path.join(dir, 'out.mp4');
  await fs.writeFile(out, storage.writes.r2[0].body);
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', out]));
  assert.deepEqual(probe.streams.map((s) => s.codec_type), ['video'], 'audio is stripped');
  assert.equal(probe.streams[0].codec_name, 'h264');
});

test('a whole upload runs through to a finished job that hands over the asset', async () => {
  const photo = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#aa3300' } }).png().toBuffer();
  const storage = fakeStorage();
  const uploadId = await uploadFile('shot.png', photo);
  let stored;
  const { jobId } = ingest.completeUpload(uploadId, { storage, onAsset: async (asset) => { stored = asset; return { ...asset, saved: true }; } });

  let job = ingest.getJob(jobId);
  for (let tries = 0; job.status === 'processing' && tries < 100; tries += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    job = ingest.getJob(jobId);
  }
  assert.equal(job.status, 'done');
  assert.equal(job.asset.saved, true);
  assert.equal(stored.originalName, 'shot.png');
});

test('a playlist disguised as an MP4 never reaches ffmpeg', async () => {
  // HLS/concat demuxers can fetch URLs or read local files, so only real containers pass.
  const playlist = Buffer.from('#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXTINF:1,\nfile:///etc/passwd\n#EXT-X-ENDLIST\n');
  const storage = fakeStorage();
  await assert.rejects(
    ingest.processUpload(await sessionFor('video', 'clip.mp4', playlist), { storage }),
    { statusCode: 400, message: /not a video/ }
  );
  assert.equal(storage.writes.r2.length, 0);
});

test('deleting an asset only ever removes keys under the CMS prefix', async () => {
  const removed = [];
  await ingest.deleteAssetFiles(
    { r2Keys: ['cms/test/a.webp', 'site-assets/about/jake.webp', 'cms/test/a-poster.webp'] },
    { remove: async (key) => removed.push(key) }
  );
  assert.deepEqual(removed, ['cms/test/a.webp', 'cms/test/a-poster.webp']);
});
