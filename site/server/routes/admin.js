const express = require('express');
const { requireAdmin, requireSameOrigin } = require('../middleware/adminAuth');
const { getAnalytics } = require('../services/analytics');
const { getCmsStore } = require('../services/cmsStore');
const { getAssetManifest } = require('../services/dropbox');
const { getPublicR2Url } = require('../services/r2');
const mediaSlots = require('../services/mediaSlots');
const ingest = require('../services/mediaIngest');
const { createAdminContentRouter } = require('./adminContent');
const { getMailConfig } = require('../services/mail');
const { isMaintenanceModeEnabled, isMaintenanceModeEnabledByEnv } = require('../middleware/maintenanceMode');

// Dashboard API, signed-in admins only (see routes/adminAuth.js for sign-in).
// Every route here is Jake-facing, so errors carry plain-English messages the
// dashboard shows as-is.

// Errors with a statusCode carry a message written for Jake; anything else is unexpected.
function sendError(res, error) {
  if (!error.statusCode) console.error('[cms]', error);
  return res
    .status(error.statusCode || 500)
    .json({ error: error.statusCode ? error.message : 'Something went wrong. Please try again.' });
}

const handle = (fn) => async (req, res) => {
  try {
    const body = await fn(req, res);
    if (!res.headersSent) res.json(body);
  } catch (error) {
    sendError(res, error);
  }
};

function failure(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

function builtInUrl(slot, manifest) {
  if (slot.defaultPath) return getPublicR2Url(slot.defaultPath);
  return manifest.assets?.[slot.defaultKey]?.url || null;
}

function createAdminRouter(options = {}) {
  const router = express.Router();
  const parseJson = express.json({ limit: '16kb', strict: true });
  const analytics = options.analytics || getAnalytics();
  const store = options.store || getCmsStore();
  const removeFiles = options.removeFiles || ingest.deleteAssetFiles;

  router.use(requireSameOrigin, requireAdmin(options.access));

  router.get('/me', (req, res) => res.json({ email: req.admin.email }));
  router.use(createAdminContentRouter({ store }));

  router.get('/stats', handle((req) => analytics.getStats(String(req.query.range || '30d'))));

  // ── Settings (apply immediately) ───────────────────────────────────────────

  async function settingsView() {
    const [settings, services] = await Promise.all([store.getSettings(), store.getPublic('services')]);
    return {
      settings,
      // What each setting falls back to, so the dashboard can say so.
      defaults: {
        enquiriesTo: (process.env.ENQUIRY_NOTIFICATION_TO || '').trim(),
        maintenanceByEnv: isMaintenanceModeEnabledByEnv()
      },
      siteIsLive: !isMaintenanceModeEnabled(process.env, settings),
      enquiriesGoTo: getMailConfig().notificationTo,
      bookingLinks: services.map((service) => ({
        id: service.id,
        name: service.name,
        bookingUrl: service.cta_url,
        applicationUrl: service.application_required ? service.application_url : null
      }))
    };
  }

  router.get('/settings', handle(settingsView));

  router.put('/settings/:section', parseJson, handle(async (req) => {
    await store.updateSettings(req.params.section, req.body, req.admin.email);
    return settingsView();
  }));

  // ── Page photo spots ───────────────────────────────────────────────────────

  router.get('/placements', handle(async () => {
    const [definitions, data, manifest] = await Promise.all([
      store.getPublic('services').then((services) => mediaSlots.listSlotDefinitions(services)),
      store.read((current) => current),
      getAssetManifest().catch(() => ({ assets: {} }))
    ]);
    const records = new Map(data.collections.placements.map((record) => [record.id, record]));
    const assets = new Map(data.media.map((asset) => [asset.id, asset]));
    const slots = definitions.map((slot) => {
      const record = records.get(slot.id);
      return {
        ...slot,
        builtInUrl: builtInUrl(slot, manifest),
        record: record ? { rev: record.rev, draft: record.draft, published: record.published, status: store.statusOf(record) } : null,
        draftAsset: record?.draft.assetId ? assets.get(record.draft.assetId) || null : null,
        liveAsset: record?.published?.assetId ? assets.get(record.published.assetId) || null : null
      };
    });
    return { slots, storage: ingest.getStorageStatus() };
  }));

  router.put('/placements/:slotId', parseJson, handle(async (req) => {
    const slot = await mediaSlots.getSlotDefinition(req.params.slotId, await store.getPublic('services'));
    if (!slot) throw failure(404, 'That photo spot does not exist.');
    const draft = { assetId: req.body?.assetId || null, alt: req.body?.alt || '' };
    if (draft.assetId) {
      const media = await store.read((data) => data.media);
      const asset = media.find((item) => item.id === draft.assetId);
      if (!asset) throw failure(404, 'That file is no longer in the media library.');
      if (asset.kind !== slot.kind) throw failure(400, slot.kind === 'video' ? 'This spot needs a video.' : 'This spot needs a photo.');
    }
    return store.saveDraft('placements', slot.id, { draft, rev: req.body?.rev }, req.admin.email, { label: slot.label, page: slot.page });
  }));

  // ── Media library ──────────────────────────────────────────────────────────

  router.get('/media', handle(async () => ({ items: await store.listMedia(), storage: ingest.getStorageStatus() })));

  router.patch('/media/:id', parseJson, handle((req) => store.updateMedia(req.params.id, { alt: req.body?.alt })));

  router.delete('/media/:id', handle(async (req) => {
    const asset = await store.removeMedia(req.params.id);
    await removeFiles(asset).catch((error) => console.error('[cms] could not delete media files:', error.message));
    return { id: asset.id, deleted: true };
  }));

  router.post('/media/uploads', parseJson, handle((req, res) => {
    const { fileName, size } = req.body || {};
    res.status(201);
    return ingest.createUploadSession({ fileName, size, uploadedBy: req.admin.email });
  }));

  router.put('/uploads/:uploadId/chunks/:index', handle((req) => (
    ingest.appendChunk(req.params.uploadId, Number(req.params.index), req)
  )));

  router.post('/uploads/:uploadId/complete', handle((req, res) => {
    res.status(202);
    return ingest.completeUpload(req.params.uploadId, { storage: options.storage, onAsset: (asset) => store.addMedia(asset) });
  }));

  router.get('/jobs/:jobId', handle((req) => {
    const job = ingest.getJob(req.params.jobId);
    if (!job) throw failure(404, 'That upload could not be found.');
    return job;
  }));

  return router;
}

module.exports = { createAdminRouter };
