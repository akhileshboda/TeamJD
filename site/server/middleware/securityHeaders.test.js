const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const request = require('supertest');
const { SECURITY_HEADERS, securityHeaders } = require('./securityHeaders');

test('every response carries the baseline security headers', async () => {
  const app = express();
  app.use(securityHeaders);
  app.get('/page', (req, res) => res.send('ok'));

  for (const path of ['/page', '/missing']) {
    const res = await request(app).get(path);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      assert.equal(res.headers[name.toLowerCase()], value, `${name} on ${path}`);
    }
  }
});
