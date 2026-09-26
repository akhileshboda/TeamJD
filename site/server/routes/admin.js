const express = require('express');
const { requireCmsAccess } = require('../middleware/cloudflareAccess');
const { getAssetManifest } = require('../services/dropbox');
const { getPublicR2Url } = require('../services/r2');
const mediaSlots = require('../services/mediaSlots');
const ingest = require('../services/mediaIngest');

// Media manager API behind Cloudflare Access. Every route here is Jake-facing, so
// errors carry plain-English messages the admin page shows as-is.

// Errors with a statusCode carry a message written for Jake; anything else is unexpected.
function sendError(res, error) {
  if (!error.statusCode) console.error('[cms]', error);
  return res
    .status(error.statusCode || 500)
    .json({ error: error.statusCode ? error.message : 'Something went wrong. Please try again.' });
}

function createAdminRouter(options = {}) {
  const router = express.Router();
  const parseJson = express.json({ limit: '16kb', strict: true });
  const storeOptions = { storePath: options.storePath, backup: options.backup ?? ingest.backupSlotStore };
  const ingestOptions = {
    storage: options.storage,
    onVersion: (slot, version) => mediaSlots.assignVersion(slot.id, version, storeOptions)
  };

  router.use(requireCmsAccess(options.access));

  async function loadSlot(req, res, next) {
    try {
      req.slot = await mediaSlots.getSlotDefinition(req.params.slotId);
    } catch (error) {
      return sendError(res, error);
    }
    if (!req.slot) return res.status(404).json({ error: 'That media spot does not exist.' });
    return next();
  }

  router.get('/me', (req, res) => res.json({ email: req.cmsUser.email }));

  router.get('/slots', async (req, res) => {
    try {
      const [definitions, store, manifest] = await Promise.all([
        mediaSlots.listSlotDefinitions(),
        mediaSlots.readStore(options.storePath),
        getAssetManifest().catch(() => ({ assets: {} }))
      ]);
      const slots = definitions.map((slot) => {
        const entry = store.slots[slot.id] || { current: null, history: [] };
        const defaultUrl = slot.defaultPath
          ? getPublicR2Url(slot.defaultPath)
          : manifest.assets?.[slot.defaultKey]?.url || null;
        return { ...slot, defaultUrl, current: entry.current, history: entry.history };
      });
      return res.json({ slots, storage: ingest.getStorageStatus() });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.post('/slots/:slotId/uploads', parseJson, loadSlot, (req, res) => {
    try {
      const { fileName, size } = req.body || {};
      return res.status(201).json(
        ingest.createUploadSession({ slot: req.slot, fileName, size, uploadedBy: req.cmsUser.email })
      );
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.put('/uploads/:uploadId/chunks/:index', async (req, res) => {
    try {
      return res.json(await ingest.appendChunk(req.params.uploadId, Number(req.params.index), req));
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.post('/uploads/:uploadId/complete', parseJson, (req, res) => {
    try {
      return res.status(202).json(ingest.completeUpload(req.params.uploadId, { alt: req.body?.alt }, ingestOptions));
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.get('/jobs/:jobId', (req, res) => {
    const job = ingest.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'That upload could not be found.' });
    return res.json(job);
  });

  router.put('/slots/:slotId/alt', parseJson, loadSlot, async (req, res) => {
    try {
      const alt = String(req.body?.alt ?? '').trim().slice(0, 300);
      return res.json(await mediaSlots.setAltText(req.slot.id, alt, storeOptions));
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.post('/slots/:slotId/restore', parseJson, loadSlot, async (req, res) => {
    try {
      return res.json(await mediaSlots.restoreVersion(req.slot.id, req.body?.assetKey, storeOptions));
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.post('/slots/:slotId/reset', loadSlot, async (req, res) => {
    try {
      return res.json(await mediaSlots.resetSlot(req.slot.id, storeOptions));
    } catch (error) {
      return sendError(res, error);
    }
  });

  return router;
}

module.exports = { createAdminRouter };
