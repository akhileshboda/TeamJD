const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const request = require('supertest');
const {
  createMaintenanceMode,
  maintenanceMode,
  isMaintenanceModeEnabled,
  isProductionRuntime
} = require('./maintenanceMode');

test('isProductionRuntime is true only for real production, not staging', () => {
  assert.equal(isProductionRuntime({ NODE_ENV: 'production' }), true);
  assert.equal(isProductionRuntime({ NODE_ENV: 'production', APP_ENV: 'staging' }), false);
  assert.equal(isProductionRuntime({ NODE_ENV: 'development' }), false);
});

test('isMaintenanceModeEnabled defaults on in production and off elsewhere, override wins both ways', () => {
  assert.equal(isMaintenanceModeEnabled({ NODE_ENV: 'production' }), true);
  assert.equal(isMaintenanceModeEnabled({ NODE_ENV: 'production', APP_ENV: 'staging' }), false);
  assert.equal(isMaintenanceModeEnabled({ NODE_ENV: 'development' }), false);
  assert.equal(isMaintenanceModeEnabled({ NODE_ENV: 'production', MAINTENANCE_MODE: 'false' }), false);
  assert.equal(isMaintenanceModeEnabled({ NODE_ENV: 'development', MAINTENANCE_MODE: 'true' }), true);
});

function buildApp() {
  const app = express();
  app.get('/healthz', (req, res) => res.json({ status: 'ok' }));
  app.use(maintenanceMode);
  app.use('/assets', express.static(__dirname));
  app.get('/api/ping', (req, res) => res.json({ ok: true }));
  app.get('/favicon.png', (req, res) => res.type('png').send('png'));
  app.get('/', (req, res) => res.send('<html>home</html>'));
  return app;
}

test('gated responses: 503.html for pages, JSON 503 for /api, Retry-After set, /healthz and /assets exempt', async () => {
  const previous = process.env.MAINTENANCE_MODE;
  process.env.MAINTENANCE_MODE = 'true';
  try {
    const app = buildApp();

    const health = await request(app).get('/healthz');
    assert.equal(health.status, 200);

    const asset = await request(app).get('/assets/maintenanceMode.js');
    assert.equal(asset.status, 200);

    // The sign-in page's tab icon must load before anyone has signed in.
    const favicon = await request(app).get('/favicon.png');
    assert.equal(favicon.status, 200);

    const api = await request(app).get('/api/ping');
    assert.equal(api.status, 503);
    assert.deepEqual(api.body, { error: 'Site is temporarily unavailable.' });
    assert.ok(api.headers['retry-after']);

    const page = await request(app).get('/');
    assert.equal(page.status, 503);
    assert.match(page.text, /Temporarily Unavailable/);
    assert.equal(page.headers['cache-control'], 'no-store');
    assert.ok(page.headers['retry-after']);
  } finally {
    if (previous === undefined) delete process.env.MAINTENANCE_MODE;
    else process.env.MAINTENANCE_MODE = previous;
  }
});

test('gate off passes requests through untouched', async () => {
  const previous = process.env.MAINTENANCE_MODE;
  process.env.MAINTENANCE_MODE = 'false';
  try {
    const app = buildApp();
    const page = await request(app).get('/');
    assert.equal(page.status, 200);
    assert.match(page.text, /home/);
  } finally {
    if (previous === undefined) delete process.env.MAINTENANCE_MODE;
    else process.env.MAINTENANCE_MODE = previous;
  }
});

test('the media manager stays reachable while the public site is gated', async () => {
  const previous = process.env.MAINTENANCE_MODE;
  process.env.MAINTENANCE_MODE = 'true';
  try {
    const app = express();
    app.use(maintenanceMode);
    app.get('/admin', (req, res) => res.send('admin'));
    app.get('/api/admin/slots', (req, res) => res.json({ ok: true }));
    app.get('/administrator', (req, res) => res.send('not exempt'));

    assert.equal((await request(app).get('/admin')).status, 200);
    assert.equal((await request(app).get('/api/admin/slots')).status, 200);
    assert.equal((await request(app).get('/administrator')).status, 503);
  } finally {
    if (previous === undefined) delete process.env.MAINTENANCE_MODE;
    else process.env.MAINTENANCE_MODE = previous;
  }
});

test('a signed-in admin sees the real site behind the gate; visitors do not', async () => {
  const previous = process.env.MAINTENANCE_MODE;
  const previousAdmins = process.env.CMS_ADMIN_EMAILS;
  process.env.MAINTENANCE_MODE = 'true';
  process.env.CMS_ADMIN_EMAILS = 'jake@team-jd.com.au';
  try {
    const app = express();
    app.use((req, res, next) => {
      req.session = req.get('X-Test-Admin') ? { admin: { email: 'jake@team-jd.com.au' } } : {};
      next();
    });
    app.use(maintenanceMode);
    app.get('/results', (req, res) => res.send('<html>results</html>'));

    assert.equal((await request(app).get('/results')).status, 503);
    const admin = await request(app).get('/results').set('X-Test-Admin', '1');
    assert.equal(admin.status, 200);
    assert.match(admin.text, /results/);
  } finally {
    if (previous === undefined) delete process.env.MAINTENANCE_MODE;
    else process.env.MAINTENANCE_MODE = previous;
    if (previousAdmins === undefined) delete process.env.CMS_ADMIN_EMAILS;
    else process.env.CMS_ADMIN_EMAILS = previousAdmins;
  }
});

async function withMaintenance(run) {
  const previous = process.env.MAINTENANCE_MODE;
  process.env.MAINTENANCE_MODE = 'true';
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.MAINTENANCE_MODE;
    else process.env.MAINTENANCE_MODE = previous;
  }
}

function buildDiscoverableApp(renderHoldingPage) {
  const app = express();
  app.use(createMaintenanceMode({ renderHoldingPage }));
  for (const file of ['/robots.txt', '/sitemap.xml', '/llms.txt', '/llms-full.txt']) {
    app.get(file, (req, res) => res.type('text/plain').send(`real ${file}`));
  }
  app.all('/', (req, res) => res.send('<html>real home</html>'));
  app.get('/about', (req, res) => res.send('<html>about</html>'));
  app.get('/api/ping', (req, res) => res.json({ ok: true }));
  return app;
}

test('search engines can still read the crawl files while the site is gated', () => withMaintenance(async () => {
  const app = buildDiscoverableApp();
  for (const file of ['/robots.txt', '/sitemap.xml', '/llms.txt', '/llms-full.txt']) {
    const response = await request(app).get(file);
    assert.equal(response.status, 200, file);
    assert.equal(response.text, `real ${file}`);
  }
}));

test('the homepage serves the indexable holding page while gated; other pages stay 503', () => withMaintenance(async () => {
  const app = buildDiscoverableApp(async () => '<html><meta name="robots" content="index, follow">holding</html>');

  const home = await request(app).get('/');
  assert.equal(home.status, 200);
  assert.match(home.text, /holding/);
  assert.doesNotMatch(home.text, /real home/);
  assert.equal(home.headers['retry-after'], undefined);
  assert.equal(home.headers['cache-control'], 'no-cache');

  const head = await request(app).head('/');
  assert.equal(head.status, 200);

  assert.equal((await request(app).post('/')).status, 503);
  assert.equal((await request(app).get('/about')).status, 503);
  assert.equal((await request(app).get('/api/ping')).status, 503);
}));

test('a failing holding page falls back to the 503 maintenance page', () => withMaintenance(async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const app = buildDiscoverableApp(async () => { throw new Error('store down'); });
    const home = await request(app).get('/');
    assert.equal(home.status, 503);
    assert.match(home.text, /Temporarily Unavailable/);
  } finally {
    console.error = originalError;
  }
}));
