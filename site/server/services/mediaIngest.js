const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const sharp = require('sharp');
const { optimizeAssetBuffer } = require('./assetOptimizer');
const { createR2ObjectKey, getAssetKey } = require('./assetClassifier');
const { getPublicR2Url, getR2Config, isR2Configured, uploadAssetToR2 } = require('./r2');
const { createDropboxClient, getSyncConfig } = require('./assetSync');

// Turns one uploaded file into a live slot version:
//   chunked upload to a temp file -> validate + compress (sharp / ffmpeg)
//   -> Dropbox /assets/<category>/ -> R2 at the key the Dropbox sync would also derive.
// Writing to Dropbox first matters: the sync rebuilds its manifest from Dropbox, so a
// file that exists there is kept and re-derived identically instead of being orphaned.

const UPLOAD_DIR = path.join(os.tmpdir(), 'teamjd-cms');
const MB = 1024 * 1024;
// Cloudflare rejects request bodies over 100 MB, so large videos arrive in pieces.
const CHUNK_BYTES = 32 * MB;
const MAX_BYTES = { image: 30 * MB, video: 1024 * MB };
const EXTENSIONS = {
  image: ['.jpg', '.jpeg', '.png', '.webp', '.avif'],
  video: ['.mp4', '.mov', '.m4v', '.webm']
};
const VIDEO_MAX_SECONDS = 180;
const VIDEO_MAX_OUTPUT_BYTES = 120 * MB;
const DROPBOX_SESSION_CHUNK = 8 * MB;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const FFMPEG_TIMEOUT_MS = 10 * 60 * 1000;
const HEIC_MESSAGE =
  'iPhone HEIC photos are not supported yet. On your iPhone, share or export the photo as a JPG and upload that.';

class IngestError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const sessions = new Map();
const jobs = new Map();
// One file is processed at a time: sharp and ffmpeg are memory-hungry and PM2
// restarts the app above 300 MB.
let processingQueue = Promise.resolve();

function getStorageStatus() {
  return { r2: isR2Configured(), dropbox: Boolean(process.env.DROPBOX_REFRESH_TOKEN) };
}

function dropStaleSessions(now = Date.now()) {
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
      fsp.rm(session.filePath, { force: true }).catch(() => {});
    }
  }
  for (const [id, job] of jobs) {
    if (job.status !== 'processing' && now - Date.parse(job.startedAt) > SESSION_TTL_MS) jobs.delete(id);
  }
}

function createUploadSession({ slot, fileName, size, uploadedBy }) {
  const extension = path.extname(String(fileName || '')).toLowerCase();
  if (['.heic', '.heif'].includes(extension)) throw new IngestError(HEIC_MESSAGE, 415);
  if (!EXTENSIONS[slot.kind].includes(extension)) {
    const allowed = slot.kind === 'video' ? 'an MP4, MOV or WebM video' : 'a JPG, PNG, WebP or AVIF photo';
    throw new IngestError(`This spot needs ${allowed}.`, 415);
  }
  if (!Number.isInteger(size) || size <= 0) throw new IngestError('The file appears to be empty.');
  if (size > MAX_BYTES[slot.kind]) {
    throw new IngestError(`That file is too large. The limit is ${MAX_BYTES[slot.kind] / MB} MB.`, 413);
  }
  const storage = getStorageStatus();
  if (!storage.r2 || !storage.dropbox) throw new IngestError('Media storage is not configured on this server.', 503);

  dropStaleSessions();
  const id = crypto.randomUUID();
  sessions.set(id, {
    id, slot, extension, size, uploadedBy,
    received: 0, nextIndex: 0, createdAt: Date.now(),
    filePath: path.join(UPLOAD_DIR, `${id}${extension}`)
  });
  return { uploadId: id, chunkBytes: CHUNK_BYTES };
}

function getSession(uploadId) {
  const session = sessions.get(uploadId);
  if (!session) throw new IngestError('This upload has expired. Please choose the file again.', 404);
  return session;
}

async function appendChunk(uploadId, index, source) {
  const session = getSession(uploadId);
  if (index !== session.nextIndex) throw new IngestError('Upload pieces arrived out of order.', 409);

  await fsp.mkdir(UPLOAD_DIR, { recursive: true });
  // Truncate to the last confirmed byte so a retried chunk never double-appends.
  await fsp.writeFile(session.filePath, '', { flag: 'a' });
  await fsp.truncate(session.filePath, session.received);

  let bytes = 0;
  const limiter = new Transform({
    transform(chunk, encoding, callback) {
      bytes += chunk.length;
      if (bytes > CHUNK_BYTES || session.received + bytes > session.size) {
        return callback(new IngestError('The file is larger than expected.', 413));
      }
      return callback(null, chunk);
    }
  });
  await pipeline(source, limiter, fs.createWriteStream(session.filePath, { flags: 'a' }));

  session.received += bytes;
  session.nextIndex += 1;
  return { received: session.received };
}

function completeUpload(uploadId, { alt = '' } = {}, options = {}) {
  const session = getSession(uploadId);
  if (session.received !== session.size) throw new IngestError('The upload did not finish. Please try again.');
  sessions.delete(uploadId);

  const job = { id: uploadId, slotId: session.slot.id, status: 'processing', startedAt: new Date().toISOString() };
  jobs.set(job.id, job);

  processingQueue = processingQueue.then(async () => {
    try {
      job.version = await processUpload(session, { alt, ...options });
      if (options.onVersion) job.entry = await options.onVersion(session.slot, job.version);
      job.status = 'done';
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof IngestError ? error.message : 'Processing failed. Please try again.';
      if (!(error instanceof IngestError)) console.error('[cms] processing failed:', error);
    } finally {
      await fsp.rm(session.filePath, { force: true }).catch(() => {});
    }
  });
  return { jobId: job.id };
}

function getJob(jobId) {
  return jobs.get(jobId) || null;
}

function versionStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').toLowerCase();
}

async function processUpload(session, { alt = '', storage = defaultStorage, now = new Date() } = {}) {
  const stamp = versionStamp(now);
  const assetKey = getAssetKey(`${session.slot.id.replace(/\./g, '-')}-${stamp}`);
  const base = { assetKey, kind: session.slot.kind, uploadedAt: now.toISOString(), uploadedBy: session.uploadedBy || null };
  const context = { session, assetKey, stamp, storage };
  const media = session.slot.kind === 'video' ? await processVideo(context) : await processImage(context);
  return { ...base, ...media, alt: session.slot.kind === 'image' ? String(alt).trim().slice(0, 300) : '' };
}

async function processImage({ session, assetKey, stamp, storage }) {
  const input = await fsp.readFile(session.filePath);
  let meta;
  try {
    meta = await sharp(input).metadata();
  } catch (error) {
    throw new IngestError('That file is not a photo we can read. Try exporting it as a JPG.');
  }
  if (meta.format === 'heif' && meta.compression !== 'av1') throw new IngestError(HEIC_MESSAGE, 415);
  const originalExtension = { jpeg: '.jpg', png: '.png', webp: '.webp', heif: '.avif' }[meta.format];
  if (!originalExtension) throw new IngestError('That file is not a JPG, PNG, WebP or AVIF photo.', 415);

  const originalName = `${assetKey}${originalExtension}`;
  const optimized = await optimizeAssetBuffer({ buffer: input, fileName: originalName });
  const { width, height } = await sharp(optimized.buffer).metadata();
  const { assetsRoot } = getSyncConfig();
  const dropboxPath = `${assetsRoot}/${session.slot.category}/${originalName}`;
  const objectKey = createR2ObjectKey({
    assetPrefix: getR2Config().assetPrefix,
    category: session.slot.category,
    fileName: optimized.fileName
  });

  await storage.putDropbox(dropboxPath, { buffer: input });
  await storage.putR2({ objectKey, buffer: optimized.buffer, contentType: optimized.contentType });

  return {
    url: getPublicR2Url(objectKey, stamp),
    width, height,
    bytes: optimized.buffer.length,
    originalBytes: input.length,
    dropboxPath
  };
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], timeout: FFMPEG_TIMEOUT_MS });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr = (stderr + data).slice(-4000); });
    child.on('error', (error) => {
      reject(error.code === 'ENOENT'
        ? new IngestError('Video processing is not available on this server yet (ffmpeg is not installed).', 503)
        : error);
    });
    child.on('close', (code) => (code === 0 ? resolve(stdout) : reject(new Error(`${command} exited ${code}: ${stderr}`))));
  });
}

// ffmpeg picks a demuxer from file contents, and some (HLS, concat) fetch URLs or read
// other local files. Only real MP4/QuickTime or Matroska/WebM containers get through,
// and that demuxer is then forced for every ffprobe/ffmpeg call on the upload.
async function detectContainer(filePath) {
  const handle = await fsp.open(filePath, 'r');
  try {
    const head = Buffer.alloc(12);
    await handle.read(head, 0, 12, 0);
    if (head.readUInt32BE(0) === 0x1a45dfa3) return 'matroska';
    if (['ftyp', 'moov', 'mdat', 'wide', 'free'].includes(head.toString('latin1', 4, 8))) return 'mov';
    throw new IngestError('That file is not a video we can read.');
  } finally {
    await handle.close();
  }
}

async function probeVideo(filePath, container) {
  let info;
  try {
    info = JSON.parse(await run('ffprobe', [
      '-v', 'error', '-f', container, '-print_format', 'json', '-show_format', '-show_streams', filePath
    ]));
  } catch (error) {
    if (error instanceof IngestError) throw error;
    throw new IngestError('That file is not a video we can read.');
  }
  const stream = (info.streams || []).find((candidate) => candidate.codec_type === 'video');
  const duration = Number(info.format?.duration);
  if (!stream || !Number.isFinite(duration)) throw new IngestError('That file is not a video we can read.');
  if (duration > VIDEO_MAX_SECONDS) {
    throw new IngestError(`That video is ${Math.round(duration)} seconds long. Please trim it to 3 minutes or less.`);
  }
  return { duration };
}

// Web-friendly H.264: at most 1920px on the long edge, capped bitrate, no audio
// (every video on the site plays muted), moov atom up front so playback starts at once.
function transcodeArgs(input, container, output) {
  return [
    '-y', '-f', container, '-i', input, '-map', '0:v:0',
    '-vf', "scale=w='min(1920,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-maxrate', '4M', '-bufsize', '8M',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', output
  ];
}

async function processVideo({ session, assetKey, stamp, storage }) {
  const container = await detectContainer(session.filePath);
  const { duration } = await probeVideo(session.filePath, container);
  const outPath = `${session.filePath}.out.mp4`;
  const posterPath = `${session.filePath}.poster.jpg`;
  try {
    await run('ffmpeg', transcodeArgs(session.filePath, container, outPath));
    await run('ffmpeg', ['-y', '-ss', String(Math.min(1, duration / 2)), '-i', outPath, '-frames:v', '1', '-q:v', '3', posterPath]);

    const { size } = await fsp.stat(outPath);
    if (size > VIDEO_MAX_OUTPUT_BYTES) throw new IngestError('That video is still too large after compression. Please use a shorter clip.');

    const poster = await optimizeAssetBuffer({ buffer: await fsp.readFile(posterPath), fileName: `${assetKey}-poster.jpg` });
    const { width, height } = await sharp(poster.buffer).metadata();
    const { assetsRoot } = getSyncConfig();
    const { assetPrefix } = getR2Config();
    const videoName = `${assetKey}.mp4`;
    const videoKey = createR2ObjectKey({ assetPrefix, category: 'video', fileName: videoName });
    const posterKey = createR2ObjectKey({ assetPrefix, category: 'video', fileName: poster.fileName });
    const dropboxPath = `${assetsRoot}/video/${videoName}`;

    await storage.putDropbox(dropboxPath, { filePath: outPath, size });
    await storage.putDropbox(`${assetsRoot}/video/${poster.fileName}`, { buffer: poster.buffer });
    await storage.putR2({ objectKey: videoKey, filePath: outPath, size, contentType: 'video/mp4' });
    await storage.putR2({ objectKey: posterKey, buffer: poster.buffer, contentType: poster.contentType });

    return {
      url: getPublicR2Url(videoKey, stamp),
      posterUrl: getPublicR2Url(posterKey, stamp),
      width, height,
      duration: Math.round(duration),
      bytes: size,
      originalBytes: session.size,
      dropboxPath
    };
  } finally {
    await fsp.rm(outPath, { force: true }).catch(() => {});
    await fsp.rm(posterPath, { force: true }).catch(() => {});
  }
}

const defaultStorage = {
  async putR2({ objectKey, buffer, filePath, size, contentType }) {
    if (filePath) {
      return uploadAssetToR2({ objectKey, stream: fs.createReadStream(filePath), contentLength: size, contentType });
    }
    return uploadAssetToR2({ objectKey, buffer, contentType });
  },

  async putDropbox(dropboxPath, { buffer, filePath, size }) {
    const client = createDropboxClient();
    if (!client) throw new IngestError('Dropbox is not configured on this server.', 503);
    const commit = { path: dropboxPath, mode: { '.tag': 'overwrite' }, autorename: false, mute: true };
    if (buffer) return client.filesUpload({ ...commit, contents: buffer });

    // Files over Dropbox's single-request limit go up in sessions, read from disk in slices.
    const handle = await fsp.open(filePath, 'r');
    try {
      let offset = 0;
      let sessionId = null;
      while (offset < size) {
        const length = Math.min(DROPBOX_SESSION_CHUNK, size - offset);
        const slice = Buffer.alloc(length);
        await handle.read(slice, 0, length, offset);
        if (sessionId === null) {
          sessionId = (await client.filesUploadSessionStart({ contents: slice, close: false })).result.session_id;
        } else {
          await client.filesUploadSessionAppendV2({ cursor: { session_id: sessionId, offset }, contents: slice, close: false });
        }
        offset += length;
      }
      return client.filesUploadSessionFinish({ cursor: { session_id: sessionId, offset }, commit, contents: Buffer.alloc(0) });
    } finally {
      await handle.close();
    }
  },

  async putJson(dropboxPath, data) {
    const client = createDropboxClient();
    if (!client) return null;
    return client.filesUpload({
      path: dropboxPath, mode: { '.tag': 'overwrite' }, mute: true,
      contents: Buffer.from(`${JSON.stringify(data, null, 2)}\n`)
    });
  }
};

// Off-server copy of the slot assignments; data/ lives only on the VM. Namespaced by
// environment because local dev and staging share the production Dropbox account.
function backupSlotStore(data) {
  const environment = process.env.APP_ENV || process.env.NODE_ENV || 'development';
  return defaultStorage.putJson(`/cms-backup/${environment}/media-slots.json`, data);
}

module.exports = {
  IngestError,
  MAX_BYTES,
  appendChunk,
  backupSlotStore,
  completeUpload,
  createUploadSession,
  getJob,
  getStorageStatus,
  processUpload
};
