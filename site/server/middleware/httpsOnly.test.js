const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const request = require('supertest');
const { HSTS_VALUE, createHttpsOnly } = require('./httpsOnly');

const productionEnv = { NODE_ENV: 'production', PUBLIC_BASE_URL: 'https://site.example.com' };

function buildApp(env = productionEnv) {
  const app = express();
  app.use(createHttpsOnly({ env }));
  app.get('/page', (req, res) => res.send('ok'));
  app.post('/form', (req, res) => res.send('posted'));
  return app;
}

test('plain-HTTP visitors are redirected to the configured HTTPS origin', async () => {
  const app = buildApp();
  const viaVisitor = await request(app).get('/page?x=1').set('CF-Visitor', '{"scheme":"http"}');
  assert.equal(viaVisitor.status, 301);
  assert.equal(viaVisitor.headers.location, 'https://site.example.com/page?x=1');

  const viaForwarded = await request(app).get('/page').set('X-Forwarded-Proto', 'http');
  assert.equal(viaForwarded.status, 301);

  // Non-GET requests keep their method.
  const post = await request(app).post('/form').set('X-Forwarded-Proto', 'http');
  assert.equal(post.status, 308);
});

test('a forged Host header cannot change the redirect target', async () => {
  const response = await request(buildApp()).get('/page')
    .set('Host', 'evil.example')
    .set('X-Forwarded-Proto', 'http');
  assert.equal(response.headers.location, 'https://site.example.com/page');
});

test('HTTPS visitors get HSTS and the page', async () => {
  const response = await request(buildApp()).get('/page').set('CF-Visitor', '{"scheme":"https"}');
  assert.equal(response.status, 200);
  assert.equal(response.headers['strict-transport-security'], HSTS_VALUE);
});

test('requests without a forwarded scheme pass untouched (local health checks)', async () => {
  const response = await request(buildApp()).get('/page');
  assert.equal(response.status, 200);
  assert.equal(response.headers['strict-transport-security'], undefined);
});

test('the backstop is off outside production or without an HTTPS base URL', async () => {
  for (const env of [
    { NODE_ENV: 'development', PUBLIC_BASE_URL: 'https://site.example.com' },
    { NODE_ENV: 'production', PUBLIC_BASE_URL: 'http://localhost:3000' }
  ]) {
    const response = await request(buildApp(env)).get('/page').set('X-Forwarded-Proto', 'http');
    assert.equal(response.status, 200);
  }
});
