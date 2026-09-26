const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const test = require('node:test');
const sharp = require('sharp');
const ingest = require('./mediaIngest');
const { createAssetSyncPlanItem } = require('./assetSync');

const STORAGE_ENV = {
  R2_ACCOUNT_ID: 'acct', R2_ACCESS_KEY_ID: 'key', R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET_NAME: 'bucket', R2_PUBLIC_BASE_URL: 'https://cdn.example', R2_ASSET_PREFIX: 'site-assets',
  DROPBOX_REFRESH_TOKEN: 'token', DROPBOX_ASSETS_ROOT: '/assets'
};
Object.assign(process.env, STORAGE_ENV);

const imageSlot = { id: 'about.portrait', kind: 'image', category: 'about' };
const videoSlot = { id: 'contact.reel', kind: 'video', category: 'video' };
const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
})();

function fakeStorage() {
  const writes = { dropbox: [], r2: [] };
  return {
    writes,
    async putDropbox(dropboxPath, { buffer, filePath }) {
      writes.dropbox.push({ dropboxPath, bytes: buffer ? buffer.length : (await fs.stat(filePath)).size });
    },
    async putR2({ objectKey, buffer, filePath, contentType }) {
      const body = buffer || (await fs.readFile(filePath));
      writes.r2.push({ objectKey, contentType, body });
    }
  };
}

async function uploadFile(slot, fileName, buffer) {
  const { uploadId } = ingest.createUploadSession({ slot, fileName, size: buffer.length, uploadedBy: 'jake@test' });
  await ingest.appendChunk(uploadId, 0, Readable.from([buffer]));
  return uploadId;
}

async function sessionFor(slot, fileName, buffer) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ingest-'));
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, buffer);
  return { slot, filePath, size: buffer.length, uploadedBy: 'jake@test' };
}

test('uploads are refused up front for the wrong type, HEIC, empty or oversized files', () => {
  const attempt = (slot, fileName, size) => () => ingest.createUploadSession({ slot, fileName, size });
  assert.throws(attempt(imageSlot, 'IMG_0001.HEIC', 1000), { statusCode: 415, message: /HEIC/ });
  assert.throws(attempt(imageSlot, 'clip.mp4', 1000), { statusCode: 415, message: /photo/ });
  assert.throws(attempt(videoSlot, 'photo.jpg', 1000), { statusCode: 415, message: /video/ });
  assert.throws(attempt(imageSlot, 'photo.jpg', 0), { statusCode: 400 });
  assert.throws(attempt(imageSlot, 'photo.jpg', ingest.MAX_BYTES.image + 1), { statusCode: 413 });
});

test('chunks must arrive in order, and a retried chunk does not double-append', async () => {
  const { uploadId } = ingest.createUploadSession({ slot: imageSlot, fileName: 'a.jpg', size: 6 });
  await assert.rejects(ingest.appendChunk(uploadId, 1, Readable.from([Buffer.from('xyz')])), { statusCode: 409 });
  await ingest.appendChunk(uploadId, 0, Readable.from([Buffer.from('abc')]));
  await assert.rejects(ingest.appendChunk(uploadId, 1, Readable.from([Buffer.from('defgh')])), { statusCode: 413 });
  const { received } = await ingest.appendChunk(uploadId, 1, Readable.from([Buffer.from('def')]));
  assert.equal(received, 6);
});

test('a photo is compressed to WebP, archived to Dropbox and stored at the key the sync derives', async () => {
  const photo = await sharp({ create: { width: 3200, height: 2000, channels: 3, background: '#335566' } }).jpeg().toBuffer();
  const storage = fakeStorage();
  const now = new Date('2026-09-26T12:00:00Z');
  const version = await ingest.processUpload(await sessionFor(imageSlot, 'portrait.jpg', photo), { alt: ' Jake on stage ', storage, now });

  assert.equal(version.assetKey, 'about-portrait-20260926t120000');
  assert.equal(version.alt, 'Jake on stage');
  assert.equal(version.width, 2400);
  assert.deepEqual(storage.writes.dropbox.map((w) => w.dropboxPath), ['/assets/about/about-portrait-20260926t120000.jpg']);
  const [r2] = storage.writes.r2;
  assert.equal(r2.contentType, 'image/webp');
  assert.equal((await sharp(r2.body).metadata()).format, 'webp');

  // Parity with the Dropbox -> R2 sync: when it later meets the archived original, it must
  // target the same object rather than orphaning or duplicating the CMS upload.
  const syncItem = createAssetSyncPlanItem({
    file: { name: 'about-portrait-20260926t120000.jpg', size: photo.length },
    source: version.dropboxPath, category: 'about', normalizedName: 'about-portrait-20260926t120000.jpg',
    dropboxDestination: version.dropboxPath, assetKey: version.assetKey, action: 'upload-existing-to-r2',
    assetPrefix: 'site-assets'
  });
  assert.equal(r2.objectKey, syncItem.r2ObjectKey);
  assert.ok(version.url.startsWith(`https://cdn.example/${syncItem.r2ObjectKey}?v=`));
});

test('a file that is not really a photo is rejected without writing anything', async () => {
  const storage = fakeStorage();
  const session = await sessionFor(imageSlot, 'fake.jpg', Buffer.from('definitely not a jpeg'));
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
  const version = await ingest.processUpload(await sessionFor(videoSlot, 'clip.mov', buffer), { storage });

  assert.deepEqual(storage.writes.r2.map((w) => w.contentType), ['video/mp4', 'image/webp']);
  assert.match(version.url, /\/site-assets\/video\/contact-reel-.*\.mp4\?v=/);
  assert.match(version.posterUrl, /-poster\.webp\?v=/);
  assert.equal(version.width, 1920);

  const out = path.join(dir, 'out.mp4');
  await fs.writeFile(out, storage.writes.r2[0].body);
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', out]));
  assert.deepEqual(probe.streams.map((s) => s.codec_type), ['video'], 'audio is stripped');
  assert.equal(probe.streams[0].codec_name, 'h264');
});

test('a whole upload runs through to a finished job', async () => {
  const photo = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#aa3300' } }).png().toBuffer();
  const storage = fakeStorage();
  const uploadId = await uploadFile(imageSlot, 'shot.png', photo);
  let assigned;
  const { jobId } = ingest.completeUpload(uploadId, { alt: 'Shot' }, {
    storage, onVersion: async (slot, version) => { assigned = { slot: slot.id, version }; return { current: version }; }
  });

  let job = ingest.getJob(jobId);
  for (let tries = 0; job.status === 'processing' && tries < 100; tries += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    job = ingest.getJob(jobId);
  }
  assert.equal(job.status, 'done');
  assert.equal(assigned.slot, 'about.portrait');
  assert.deepEqual(storage.writes.dropbox.map((w) => path.extname(w.dropboxPath)), ['.png']);
});

test('a playlist disguised as an MP4 never reaches ffmpeg', async () => {
  // HLS/concat demuxers can fetch URLs or read local files, so only real containers pass.
  const playlist = Buffer.from('#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXTINF:1,\nfile:///etc/passwd\n#EXT-X-ENDLIST\n');
  const storage = fakeStorage();
  await assert.rejects(
    ingest.processUpload(await sessionFor(videoSlot, 'clip.mp4', playlist), { storage }),
    { statusCode: 400, message: /not a video/ }
  );
  assert.equal(storage.writes.r2.length, 0);
});
