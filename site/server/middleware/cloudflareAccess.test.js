const assert = require('node:assert/strict');
const crypto = require('crypto');
const test = require('node:test');
const express = require('express');
const request = require('supertest');
const { requireCmsAccess, resetKeyCache, getAccessConfig } = require('./cloudflareAccess');

const TEAM = 'teamjd.cloudflareaccess.com';
const AUD = 'aud-tag-123';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const { privateKey: otherKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'key-1', alg: 'RS256' };
const fetchImpl = async () => ({ ok: true, json: async () => ({ keys: [jwk] }) });

function sign(claims = {}, { key = privateKey, kid = 'key-1' } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    aud: [AUD], iss: `https://${TEAM}`, email: 'jake@team-jd.com.au', iat: now, exp: now + 600, ...claims
  })).toString('base64url');
  const signature = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), key).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

function buildApp(env) {
  resetKeyCache();
  const app = express();
  app.get('/api/admin/me', requireCmsAccess({ env, fetchImpl }), (req, res) => res.json(req.cmsUser));
  return app;
}

const prodEnv = {
  NODE_ENV: 'production', CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, CMS_ADMIN_EMAILS: 'jake@team-jd.com.au'
};

test('a valid Access token for an allowed email is accepted', async () => {
  const res = await request(buildApp(prodEnv)).get('/api/admin/me').set('Cf-Access-Jwt-Assertion', sign());
  assert.equal(res.status, 200);
  assert.equal(res.body.email, 'jake@team-jd.com.au');
});

test('missing, forged, mis-addressed, expired and non-allowlisted tokens are rejected', async () => {
  const now = Math.floor(Date.now() / 1000);
  const cases = {
    missing: null,
    garbage: 'not.a.token',
    'wrong signing key': sign({}, { key: otherKey }),
    'unknown kid': sign({}, { kid: 'key-2' }),
    'wrong audience': sign({ aud: ['someone-else'] }),
    'wrong issuer': sign({ iss: 'https://evil.cloudflareaccess.com' }),
    expired: sign({ exp: now - 3600 }),
    'not allowlisted': sign({ email: 'stranger@example.com' })
  };
  for (const [name, token] of Object.entries(cases)) {
    const req = request(buildApp(prodEnv)).get('/api/admin/me');
    const res = token ? await req.set('Cf-Access-Jwt-Assertion', token) : await req;
    assert.equal(res.status, 401, name);
  }
});

test('production fails closed when Access is not configured', async () => {
  const res = await request(buildApp({ NODE_ENV: 'production' })).get('/api/admin/me');
  assert.equal(res.status, 503);
});

test('the localhost bypass only works outside production, including staging', () => {
  assert.equal(getAccessConfig({ NODE_ENV: 'development', CMS_DEV_BYPASS: 'true' }).devBypass, true);
  assert.equal(getAccessConfig({ NODE_ENV: 'production', CMS_DEV_BYPASS: 'true' }).devBypass, false);
  assert.equal(
    getAccessConfig({ NODE_ENV: 'production', APP_ENV: 'staging', CMS_DEV_BYPASS: 'true' }).devBypass,
    false
  );
});
