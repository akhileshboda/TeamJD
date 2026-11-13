const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const request = require('supertest');
const { SECURITY_HEADERS, buildContentSecurityPolicy, securityHeaders } = require('./securityHeaders');

test('every response carries the baseline security headers', async () => {
  const app = express();
  app.use(securityHeaders);
  app.get('/page', (req, res) => res.send('ok'));

  for (const path of ['/page', '/missing']) {
    const res = await request(app).get(path);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      assert.equal(res.headers[name.toLowerCase()], value, `${name} on ${path}`);
    }
    assert.equal(res.headers['cross-origin-opener-policy'], 'same-origin');
  }
});

test('CSP ships report-only by default and enforces with CSP_ENFORCE=true', async () => {
  const previous = process.env.CSP_ENFORCE;
  const app = express();
  app.use(securityHeaders);
  app.get('/page', (req, res) => res.send('ok'));

  try {
    delete process.env.CSP_ENFORCE;
    const reportOnly = await request(app).get('/page');
    assert.ok(reportOnly.headers['content-security-policy-report-only']);
    assert.equal(reportOnly.headers['content-security-policy'], undefined);

    process.env.CSP_ENFORCE = 'true';
    const enforced = await request(app).get('/page');
    assert.ok(enforced.headers['content-security-policy']);
    assert.equal(enforced.headers['content-security-policy-report-only'], undefined);
  } finally {
    if (previous === undefined) delete process.env.CSP_ENFORCE;
    else process.env.CSP_ENFORCE = previous;
  }
});

test('CSP allows only the origins the site uses and blocks plugins and framing', () => {
  const policy = buildContentSecurityPolicy({ R2_PUBLIC_BASE_URL: 'https://media.example.com/' });
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /img-src 'self' https:\/\/media\.example\.com data: blob:/);
  assert.match(policy, /script-src 'self' 'sha256-[^']+' https:\/\/challenges\.cloudflare\.com/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /frame-ancestors 'self'/);
  assert.doesNotMatch(policy, /script-src[^;]*'unsafe-inline'/);
});
