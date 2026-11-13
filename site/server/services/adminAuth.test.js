const assert = require('node:assert/strict');
const test = require('node:test');
const { isDevBypass, isLocalDevelopment } = require('./adminAuth');

test('dev bypass works only for a local development run', () => {
  assert.equal(isDevBypass({ NODE_ENV: 'development', CMS_DEV_BYPASS: 'true' }), true);
  assert.equal(isDevBypass({
    NODE_ENV: 'development', CMS_DEV_BYPASS: 'true', PUBLIC_BASE_URL: 'http://localhost:3100'
  }), true);
  assert.equal(isDevBypass({ NODE_ENV: 'development', CMS_DEV_BYPASS: 'false' }), false);
});

test('dev bypass is ignored on anything that looks deployed', () => {
  assert.equal(isDevBypass({ NODE_ENV: 'production', CMS_DEV_BYPASS: 'true' }), false);
  assert.equal(isDevBypass({ NODE_ENV: 'development', APP_ENV: 'staging', CMS_DEV_BYPASS: 'true' }), false);
  assert.equal(isDevBypass({
    NODE_ENV: 'development', CMS_DEV_BYPASS: 'true', PUBLIC_BASE_URL: 'https://staging.example.com'
  }), false);
  assert.equal(isLocalDevelopment({ NODE_ENV: 'development', PUBLIC_BASE_URL: 'not a url' }), false);
});
