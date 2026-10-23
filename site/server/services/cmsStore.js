const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { COLLECTIONS, PUBLIC_OUTPUTS, SEED_DIR, foldTestimonialsIntoResults, mediaUsage } = require('./cmsCollections');
const { normalizeSection, withDefaults } = require('./cmsSettings');

// The dashboard's content store: one JSON file holding every collection.
//
// { schemaVersion, collections: { [name]: Record[] }, media: Asset[], settings }
// Record: { id, order, draft, published | null, rev, createdAt, updatedAt,
//           updatedBy, publishedAt, hiddenAt }
//
// Jake edits `draft`; the public site only ever sees `published`. `rev` goes up
// whenever a draft changes, so an edit from a stale tab is refused (409).
// `order` sits outside draft/published: reordering goes live immediately.
//
// Writes are serialised and atomic (tmp file + rename). data/ lives only on the
// VM, so every change also schedules a Dropbox backup.

const STORE_PATH = process.env.CMS_DATA_PATH || path.join(__dirname, '..', '..', 'data', 'cms.json');
const SCHEMA_VERSION = 2;
const BACKUP_DELAY_MS = 10 * 1000;

class CmsError extends Error {
  constructor(statusCode, message, fields) {
    super(message);
    this.statusCode = statusCode;
    if (fields) this.fields = fields;
  }
}

function statusOf(record) {
  if (!record.published) return record.hiddenAt ? 'hidden' : 'draft';
  return JSON.stringify(record.draft) === JSON.stringify(record.published) ? 'published' : 'changed';
}

function withStatus(record) {
  return { ...record, status: statusOf(record) };
}

function collectionDef(name) {
  const def = Object.hasOwn(COLLECTIONS, name) ? COLLECTIONS[name] : null;
  if (!def) throw new CmsError(404, 'That section does not exist.');
  return def;
}

function findRecord(data, name, id) {
  const def = collectionDef(name);
  const record = data.collections[name].find((item) => item.id === String(id));
  if (!record) throw new CmsError(404, `That ${def.label} no longer exists. It may have been deleted in another tab.`);
  return record;
}

function sortedByOrder(records) {
  return [...records].sort((a, b) => a.order - b.order);
}

function stampRecord(record, user, now) {
  record.updatedAt = now;
  record.updatedBy = user || 'unknown';
}

// `rev` counts changes to the draft only. Publishing or hiding leaves the draft
// as it was, so an editor still open on it (say Jake pressed "Publish all" in
// the top bar mid-edit) can keep autosaving without a false conflict.
function touchRecord(record, user, now) {
  record.rev += 1;
  stampRecord(record, user, now);
}

const STALE_MESSAGE = 'This was changed in another tab or window. Reload to see the latest version.';

function assertPublishable(data, name, record) {
  const errors = collectionDef(name).validateForPublish(record.draft, data);
  if (Object.keys(errors).length) {
    throw new CmsError(422, 'Some fields need attention before this can go live.', errors);
  }
}

// Record operations, shared by the single-item endpoints and bulk actions.
const OPERATIONS = {
  publish(data, name, record, user, now) {
    assertPublishable(data, name, record);
    record.published = structuredClone(record.draft);
    record.publishedAt = now;
    record.hiddenAt = null;
    stampRecord(record, user, now);
  },
  unpublish(data, name, record, user, now) {
    const def = collectionDef(name);
    if (def.canHide === false) throw new CmsError(405, `A ${def.label} cannot be hidden here.`);
    record.published = null;
    record.hiddenAt = now;
    stampRecord(record, user, now);
  },
  discard(data, name, record, user, now) {
    if (!record.published) {
      throw new CmsError(409, 'This has never been published, so there is no live version to go back to.');
    }
    record.draft = structuredClone(record.published);
    touchRecord(record, user, now);
  },
  delete(data, name, record, user, now) {
    const def = collectionDef(name);
    if (def.canDelete === false) throw new CmsError(405, `A ${def.label} cannot be deleted here.`);
    data.collections[name] = data.collections[name].filter((item) => item !== record);
    def.onDelete?.(data, record, (other) => touchRecord(other, user, now));
  }
};

// One public output the site reads (results, slots, ...), from live records only.
function buildPublic(data, publicName) {
  const build = Object.hasOwn(PUBLIC_OUTPUTS, publicName) ? PUBLIC_OUTPUTS[publicName] : null;
  if (!build) throw new CmsError(404, 'Not found.');
  const sortedLive = (name) => sortedByOrder(data.collections[name]).filter((record) => record.published);
  return build(data, sortedLive);
}

async function backupToDropbox(data) {
  // Lazy: the Dropbox client pulls in the whole asset-sync module.
  const { createDropboxClient } = require('./assetSync');
  const client = createDropboxClient();
  if (!client) return;
  const environment = process.env.APP_ENV || process.env.NODE_ENV || 'development';
  await client.filesUpload({
    path: `/cms-backup/${environment}/cms.json`,
    mode: { '.tag': 'overwrite' },
    mute: true,
    contents: Buffer.from(`${JSON.stringify(data, null, 2)}\n`)
  });
}

function debounce(task, delayMs) {
  let timer = null;
  let latest = null;
  return (data) => {
    latest = data;
    clearTimeout(timer);
    timer = setTimeout(() => {
      task(latest).catch((error) => console.error('[cms] Dropbox backup failed:', error.message));
    }, delayMs);
    timer.unref?.();
  };
}

function createCmsStore(options = {}) {
  const storePath = options.storePath || STORE_PATH;
  const seedDir = options.seedDir || SEED_DIR;
  const now = options.now || (() => new Date().toISOString());
  const backup = options.backup === undefined ? debounce(backupToDropbox, BACKUP_DELAY_MS) : options.backup;
  let cache = null;
  let queue = Promise.resolve();

  // Flushed to disk before the rename, so a power cut leaves the old file or the
  // new one, never an empty one the server cannot start with.
  async function write(data) {
    const tmpPath = `${storePath}.tmp`;
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    const handle = await fs.open(tmpPath, 'w');
    try {
      await handle.writeFile(`${JSON.stringify(data, null, 2)}\n`);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(tmpPath, storePath);
  }

  // Seeds the whole file when it is missing, and any collection added since.
  // An existing empty collection is never re-seeded.
  async function load() {
    if (cache) return cache;
    let data = null;
    try {
      data = JSON.parse(await fs.readFile(storePath, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    let changed = !data;
    data ??= { schemaVersion: SCHEMA_VERSION, collections: {}, media: [], settings: {} };
    data.collections ??= {};
    data.media ??= [];
    data.settings ??= {};
    if (foldTestimonialsIntoResults(data)) changed = true;
    if (data.schemaVersion !== SCHEMA_VERSION) {
      data.schemaVersion = SCHEMA_VERSION;
      changed = true;
    }
    for (const [name, def] of Object.entries(COLLECTIONS)) {
      if (!Array.isArray(data.collections[name])) {
        data.collections[name] = def.seed({ now: now(), seedDir });
        changed = true;
      }
    }
    if (changed) await write(data);
    cache = data;
    return data;
  }

  function enqueue(task) {
    const run = queue.then(task);
    queue = run.catch(() => {});
    return run;
  }

  function read(selector) {
    return enqueue(async () => selector(await load()));
  }

  function mutate(change) {
    return enqueue(async () => {
      const next = structuredClone(await load());
      const result = change(next, now());
      await write(next);
      cache = next;
      if (backup) backup(next);
      return result;
    });
  }

  function summaryRow(data, name, record) {
    return {
      id: record.id,
      order: record.order,
      status: statusOf(record),
      updatedAt: record.updatedAt,
      updatedBy: record.updatedBy,
      ...collectionDef(name).summarize(record, data)
    };
  }

  return {
    read,
    mutate,
    statusOf,

    list(name) {
      collectionDef(name);
      return read((data) => sortedByOrder(data.collections[name]).map((record) => summaryRow(data, name, record)));
    },

    get(name, id) {
      return read((data) => {
        const record = findRecord(data, name, id);
        const usage = collectionDef(name).usage?.(data, record) || [];
        return { ...withStatus(record), usage };
      });
    },

    create(name, input, user) {
      const def = collectionDef(name);
      if (def.canCreate === false) return Promise.reject(new CmsError(405, `A new ${def.label} cannot be added here.`));
      return mutate((data, at) => {
        const records = data.collections[name];
        // New items go to the top, where Jake will look for them.
        const order = records.length ? Math.min(...records.map((item) => item.order)) - 1 : 1;
        const record = {
          id: crypto.randomUUID(),
          order,
          draft: def.normalizeDraft(input),
          published: null,
          rev: 1,
          createdAt: at,
          updatedAt: at,
          updatedBy: user || 'unknown',
          publishedAt: null,
          hiddenAt: null
        };
        records.push(record);
        return withStatus(record);
      });
    },

    // `meta` labels a record created on first save (createOnSave collections).
    saveDraft(name, id, { draft, rev } = {}, user, meta = {}) {
      const def = collectionDef(name);
      if (!Number.isInteger(rev)) return Promise.reject(new CmsError(400, 'Missing revision number. Reload the page.'));
      return mutate((data, at) => {
        const exists = data.collections[name].some((item) => item.id === String(id));
        if (!exists && def.createOnSave) {
          data.collections[name].push({
            id: String(id), order: 0, ...meta, draft: def.normalizeDraft({}), published: null,
            rev: 0, createdAt: at, updatedAt: at, updatedBy: user || 'unknown', publishedAt: null, hiddenAt: null
          });
        }
        const record = findRecord(data, name, id);
        if (record.rev !== rev) throw new CmsError(409, STALE_MESSAGE);
        // The current draft lets a collection keep fields Jake cannot change.
        record.draft = def.normalizeDraft(draft, record.draft);
        touchRecord(record, user, at);
        return withStatus(record);
      });
    },

    // With `rev` (the editor sends it), the action only goes ahead on the draft
    // that tab has seen, so it never publishes or discards another tab's edits.
    apply(name, id, action, user, rev) {
      const operation = Object.hasOwn(OPERATIONS, action) ? OPERATIONS[action] : null;
      if (!operation) return Promise.reject(new CmsError(400, 'Unknown action.'));
      return mutate((data, at) => {
        const record = findRecord(data, name, id);
        if (Number.isInteger(rev) && record.rev !== rev) throw new CmsError(409, STALE_MESSAGE);
        operation(data, name, record, user, at);
        return action === 'delete' ? { id: record.id, deleted: true } : withStatus(record);
      });
    },

    // One write for the whole batch; items that cannot change are reported, not
    // fatal, so "publish 20" still publishes the 18 that are ready.
    bulk(targets, action, user) {
      const operation = Object.hasOwn(OPERATIONS, action) ? OPERATIONS[action] : null;
      if (!operation) return Promise.reject(new CmsError(400, 'Unknown action.'));
      if (!Array.isArray(targets) || !targets.length) return Promise.reject(new CmsError(400, 'Select at least one item.'));
      return mutate((data, at) => {
        const done = [];
        const failed = [];
        for (const { collection, id } of targets) {
          try {
            operation(data, collection, findRecord(data, collection, id), user, at);
            done.push({ collection, id: String(id) });
          } catch (error) {
            if (!(error instanceof CmsError)) throw error;
            failed.push({ collection, id: String(id), error: error.message, fields: error.fields });
          }
        }
        return { done, failed };
      });
    },

    reorder(name, ids) {
      collectionDef(name);
      return mutate((data) => {
        const records = data.collections[name];
        const wanted = new Set((ids || []).map(String));
        if (wanted.size !== records.length || !records.every((item) => wanted.has(item.id))) {
          throw new CmsError(409, 'The list changed while you were reordering. Reload and try again.');
        }
        const position = new Map([...wanted].map((id, index) => [id, index + 1]));
        for (const record of records) record.order = position.get(record.id);
        return sortedByOrder(records).map((record) => summaryRow(data, name, record));
      });
    },

    // Unpublished changes across collections: edits to live items, and new
    // drafts where there is no offline state to keep them in (page images).
    // An offline result or FAQ only goes live by switching it on, so "Publish
    // all" never puts one on the site.
    pending() {
      return read((data) => Object.keys(COLLECTIONS).flatMap((name) => sortedByOrder(data.collections[name])
        .filter((record) => {
          const status = statusOf(record);
          return status === 'changed' || (status === 'draft' && COLLECTIONS[name].canHide === false);
        })
        .map((record) => ({ collection: name, ...summaryRow(data, name, record) }))));
    },

    getSettings() {
      return read((data) => withDefaults(data.settings));
    },

    // Applies at once: settings are not drafted.
    updateSettings(section, input, user) {
      return mutate((data, at) => {
        const value = normalizeSection(section, input);
        data.settings = { ...data.settings, [section]: value, updatedAt: at, updatedBy: user || 'unknown' };
        return withDefaults(data.settings);
      });
    },

    // Synchronous read for per-request code (maintenance gate, enquiry email).
    // Null until the store has loaded; app.js loads it at startup.
    cachedSettings() {
      return cache ? withDefaults(cache.settings) : null;
    },

    listMedia() {
      return read((data) => [...data.media]
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
        .map((asset) => ({ ...asset, usage: mediaUsage(data, asset.id) })));
    },

    addMedia(asset) {
      return mutate((data) => {
        data.media.push(asset);
        return { ...asset, usage: [] };
      });
    },

    updateMedia(id, { alt }) {
      return mutate((data) => {
        const asset = data.media.find((item) => item.id === id);
        if (!asset) throw new CmsError(404, 'That file is no longer in the media library.');
        asset.alt = String(alt ?? '').trim().slice(0, 300);
        return { ...asset, usage: mediaUsage(data, id) };
      });
    },

    // Refused while anything (live or draft) still uses the file; the caller then
    // removes the returned asset's files from storage.
    removeMedia(id) {
      return mutate((data) => {
        const asset = data.media.find((item) => item.id === id);
        if (!asset) throw new CmsError(404, 'That file is no longer in the media library.');
        const usage = mediaUsage(data, id);
        if (usage.length) {
          throw new CmsError(409, `This is still used in: ${usage.map((use) => use.title).join('; ')}. Choose something else there first.`);
        }
        data.media = data.media.filter((item) => item !== asset);
        return asset;
      });
    },

    getPublic(publicName) {
      return read((data) => buildPublic(data, publicName));
    },

    // The public collection as it would look if this draft were live, for the
    // dashboard's preview. Nothing is saved.
    preview(name, id, draft) {
      const def = collectionDef(name);
      return read((source) => {
        const data = structuredClone(source);
        let record = id ? data.collections[name].find((item) => item.id === String(id)) : null;
        const normalized = def.normalizeDraft(draft, record?.draft);
        if (!record) {
          const firstOrder = Math.min(1, ...data.collections[name].map((item) => item.order));
          record = { id: id ? String(id) : 'preview', order: firstOrder - 1, rev: 0 };
          data.collections[name].push(record);
        }
        record.draft = normalized;
        record.published = normalized;
        return { [def.publicCollection]: buildPublic(data, def.publicCollection) };
      });
    }
  };
}

let defaultStore = null;
function getCmsStore() {
  defaultStore ??= createCmsStore();
  return defaultStore;
}

module.exports = {
  CmsError,
  createCmsStore,
  getCmsStore,
  statusOf
};
