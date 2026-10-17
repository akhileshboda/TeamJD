const express = require('express');
const { getCmsStore } = require('../services/cmsStore');

// Dashboard content API, mounted inside the signed-in admin router:
//   /collections/:collection[/...]  list, read, create, save draft, publish …
//   /pending, /publish              everything not live yet, "Publish all"

const SINGLE_ACTIONS = new Set(['publish', 'unpublish', 'discard']);
const BULK_ACTIONS = new Set(['publish', 'unpublish', 'delete']);

function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function sendError(res, error) {
  if (!error.statusCode) console.error('[cms]', error);
  return res.status(error.statusCode || 500).json({
    error: error.statusCode ? error.message : 'Something went wrong. Please try again.',
    ...(error.fields ? { fields: error.fields } : {})
  });
}

// Wraps an async handler so every failure reaches sendError.
const handle = (fn) => async (req, res) => {
  try {
    const body = await fn(req, res);
    if (!res.headersSent) res.json(body);
  } catch (error) {
    sendError(res, error);
  }
};

function createAdminContentRouter({ store = getCmsStore() } = {}) {
  const router = express.Router();
  const parseJson = express.json({ limit: '64kb', strict: true });
  const user = (req) => req.admin.email;

  router.get('/pending', handle(async () => ({ items: await store.pending() })));

  router.post('/publish', parseJson, handle(async (req) => {
    const targets = req.body?.all ? await store.pending() : req.body?.targets;
    return store.bulk((targets || []).map(({ collection, id }) => ({ collection, id })), 'publish', user(req));
  }));

  const collection = express.Router({ mergeParams: true });
  router.use('/collections/:collection', collection);

  collection.get('/', handle(async (req) => ({ items: await store.list(req.params.collection) })));

  collection.post('/', parseJson, handle(async (req, res) => {
    res.status(201);
    return store.create(req.params.collection, req.body?.draft || {}, user(req));
  }));

  // Registered before /:id so "order", "bulk" and "preview" are not read as ids.
  collection.put('/order', parseJson, handle(async (req) => ({
    items: await store.reorder(req.params.collection, req.body?.ids)
  })));

  collection.post('/bulk', parseJson, handle(async (req) => {
    const { action, ids } = req.body || {};
    if (!BULK_ACTIONS.has(action)) throw badRequest('Unknown action.');
    const targets = (Array.isArray(ids) ? ids : []).map((id) => ({ collection: req.params.collection, id }));
    return store.bulk(targets, action, user(req));
  }));

  collection.post('/preview', parseJson, handle(async (req) => (
    store.preview(req.params.collection, req.body?.id, req.body?.draft || {})
  )));

  collection.get('/:id', handle(async (req) => store.get(req.params.collection, req.params.id)));

  collection.put('/:id', parseJson, handle(async (req) => (
    store.saveDraft(req.params.collection, req.params.id, req.body || {}, user(req))
  )));

  collection.post('/:id/:action', parseJson, handle(async (req) => {
    if (!SINGLE_ACTIONS.has(req.params.action)) throw badRequest('Unknown action.');
    return store.apply(req.params.collection, req.params.id, req.params.action, user(req), req.body?.rev);
  }));

  collection.delete('/:id', handle(async (req) => store.apply(req.params.collection, req.params.id, 'delete', user(req))));

  return router;
}

module.exports = { createAdminContentRouter };
