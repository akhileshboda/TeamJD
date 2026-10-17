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
const { deleteR2Object, getPublicR2Url, getR2Config, isR2Configured, uploadAssetToR2 } = require('./r2');
const { createDropboxClient } = require('./assetSync');

// Turns one uploaded file into a media-library asset:
//   chunked upload to a temp file -> validate + compress (sharp / ffmpeg)
//   -> R2 under its own prefix, cms/<environment>/<asset id>.<ext>
//   -> best-effort copy of the original to Dropbox /cms-backup/<environment>/media/.
//
// The CMS prefix sits outside the Dropbox->R2 sync's prefix (site-assets/), and the
// sync only ever lists, replaces or deletes keys under its own prefix, so library
// files are never touched by it. Asset ids are random, so URLs never need a version.

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
const KIND_BY_EXTENSION = Object.fromEntries(
  Object.entries(EXTENSIONS).flatMap(([kind, extensions]) => extensions.map((extension) => [extension, kind]))
);
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

function environmentName() {
  return process.env.APP_ENV || process.env.NODE_ENV || 'development';
}

// cms/<environment>: dev, staging and production share one bucket and Dropbox.
function getCmsPrefix() {
  const root = String(process.env.R2_CMS_PREFIX || 'cms').replace(/^\/+|\/+$/g, '');
  return `${root}/${environmentName()}`;
}

// Library uploads must never land where the Dropbox->R2 sync manages (and deletes) keys.
function cmsPrefixIsSafe(cmsPrefix = getCmsPrefix(), assetPrefix = getR2Config().assetPrefix) {
  const cmsRoot = cmsPrefix.split('/')[0];
  const syncRoot = String(assetPrefix || '').replace(/^\/+|\/+$/g, '').split('/')[0];
  return Boolean(cmsRoot && syncRoot && cmsRoot !== syncRoot);
}

function getStorageStatus() {
  return { r2: isR2Configured(), dropbox: Boolean(process.env.DROPBOX_REFRESH_TOKEN), prefixSafe: cmsPrefixIsSafe() };
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

function createUploadSession({ fileName, size, uploadedBy }) {
  const extension = path.extname(String(fileName || '')).toLowerCase();
  if (['.heic', '.heif'].includes(extension)) throw new IngestError(HEIC_MESSAGE, 415);
  const kind = KIND_BY_EXTENSION[extension];
  if (!kind) throw new IngestError('Upload a JPG, PNG, WebP or AVIF photo, or an MP4, MOV or WebM video.', 415);
  if (!Number.isInteger(size) || size <= 0) throw new IngestError('The file appears to be empty.');
  if (size > MAX_BYTES[kind]) {
    throw new IngestError(`That file is too large. The limit is ${MAX_BYTES[kind] / MB} MB for a ${kind === 'video' ? 'video' : 'photo'}.`, 413);
  }
  const storage = getStorageStatus();
  if (!storage.r2) throw new IngestError('Media storage is not set up on this server.', 503);
  if (!storage.prefixSafe) throw new IngestError('Media storage is misconfigured on this server (R2_CMS_PREFIX).', 503);

  dropStaleSessions();
  const id = crypto.randomUUID();
  sessions.set(id, {
    id, kind, extension, size, uploadedBy,
    originalName: path.basename(String(fileName)).replace(/[^\w.\- ]+/g, '').slice(0, 120) || `upload${extension}`,
    received: 0, nextIndex: 0, createdAt: Date.now(),
    filePath: path.join(UPLOAD_DIR, `${id}${extension}`)
  });
  return { uploadId: id, chunkBytes: CHUNK_BYTES, kind };
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

function completeUpload(uploadId, options = {}) {
  const session = getSession(uploadId);
  if (session.received !== session.size) throw new IngestError('The upload did not finish. Please try again.');
  sessions.delete(uploadId);

  const job = { id: uploadId, kind: session.kind, status: 'processing', startedAt: new Date().toISOString() };
  jobs.set(job.id, job);

  processingQueue = processingQueue.then(async () => {
    try {
      const asset = await processUpload(session, options);
      job.asset = options.onAsset ? await options.onAsset(asset) : asset;
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

async function processUpload(session, { storage = defaultStorage, now = new Date() } = {}) {
  const id = crypto.randomUUID();
  const context = { session, id, prefix: getCmsPrefix(), storage };
  const media = session.kind === 'video' ? await processVideo(context) : await processImage(context);
  return {
    id,
    kind: session.kind,
    ...media,
    originalName: session.originalName,
    alt: '',
    uploadedAt: now.toISOString(),
    uploadedBy: session.uploadedBy || null
  };
}

// The original (or transcoded video) is copied to Dropbox as a backup. A failure is
// recorded on the asset but never fails the upload: R2 already has the file.
async function backupOriginal(storage, { id, session }, source) {
  const dropboxPath = `/cms-backup/${environmentName()}/media/${id}-${session.originalName}`;
  try {
    const result = await storage.putDropbox(dropboxPath, source);
    return result === null ? 'skipped' : 'done';
  } catch (error) {
    console.error('[cms] media backup to Dropbox failed:', error.message);
    return 'failed';
  }
}

async function processImage({ session, id, prefix, storage }) {
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

  const optimized = await optimizeAssetBuffer({ buffer: input, fileName: `${id}${originalExtension}` });
  const { width, height } = await sharp(optimized.buffer).metadata();
  const objectKey = `${prefix}/${id}${path.extname(optimized.fileName)}`;
  await storage.putR2({ objectKey, buffer: optimized.buffer, contentType: optimized.contentType });

  return {
    url: getPublicR2Url(objectKey),
    posterUrl: null,
    width, height,
    bytes: optimized.buffer.length,
    originalBytes: input.length,
    r2Keys: [objectKey],
    backup: await backupOriginal(storage, { id, session }, { buffer: input })
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

async function processVideo({ session, id, prefix, storage }) {
  const container = await detectContainer(session.filePath);
  const { duration } = await probeVideo(session.filePath, container);
  const outPath = `${session.filePath}.out.mp4`;
  const posterPath = `${session.filePath}.poster.jpg`;
  try {
    await run('ffmpeg', transcodeArgs(session.filePath, container, outPath));
    await run('ffmpeg', ['-y', '-ss', String(Math.min(1, duration / 2)), '-i', outPath, '-frames:v', '1', '-q:v', '3', posterPath]);

    const { size } = await fsp.stat(outPath);
    if (size > VIDEO_MAX_OUTPUT_BYTES) throw new IngestError('That video is still too large after compression. Please use a shorter clip.');

    const poster = await optimizeAssetBuffer({ buffer: await fsp.readFile(posterPath), fileName: `${id}-poster.jpg` });
    const { width, height } = await sharp(poster.buffer).metadata();
    const videoKey = `${prefix}/${id}.mp4`;
    const posterKey = `${prefix}/${id}-poster${path.extname(poster.fileName)}`;

    await storage.putR2({ objectKey: videoKey, filePath: outPath, size, contentType: 'video/mp4' });
    await storage.putR2({ objectKey: posterKey, buffer: poster.buffer, contentType: poster.contentType });

    return {
      url: getPublicR2Url(videoKey),
      posterUrl: getPublicR2Url(posterKey),
      width, height,
      duration: Math.round(duration),
      bytes: size,
      originalBytes: session.size,
      r2Keys: [videoKey, posterKey],
      // Streamed from disk in slices, before the finally block removes the file.
      backup: await backupOriginal(storage, { id, session }, { filePath: outPath, size })
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
    if (!client) return null;
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
  }
};

// Removes a deleted asset's files from R2. Only keys under the CMS prefix are ever
// deleted, whatever the asset record says.
async function deleteAssetFiles(asset, { remove = deleteR2Object } = {}) {
  const root = `${getCmsPrefix().split('/')[0]}/`;
  for (const key of asset.r2Keys || []) {
    if (key.startsWith(root)) await remove(key);
  }
}

module.exports = {
  IngestError,
  MAX_BYTES,
  appendChunk,
  cmsPrefixIsSafe,
  completeUpload,
  createUploadSession,
  deleteAssetFiles,
  getCmsPrefix,
  getJob,
  getStorageStatus,
  processUpload
};
