const assert = require('node:assert/strict');
const test = require('node:test');
const { getClientIp, normalizeIp } = require('./clientIp');

function request(peer, headers = {}) {
  return {
    socket: { remoteAddress: peer },
    get(name) {
      return headers[name.toLowerCase()];
    }
  };
}

test('accepts a valid Cloudflare client IP only from a loopback tunnel peer', () => {
  assert.equal(
    getClientIp(request('127.0.0.1', { 'cf-connecting-ip': '203.0.113.7' })),
    '203.0.113.7'
  );
  assert.equal(
    getClientIp(request('198.51.100.20', { 'cf-connecting-ip': '203.0.113.7' })),
    '198.51.100.20'
  );
});

test('does not trust X-Forwarded-For or malformed/multiple Cloudflare values', () => {
  assert.equal(
    getClientIp(request('127.0.0.1', { 'x-forwarded-for': 'attacker.example', 'cf-connecting-ip': '203.0.113.7, 198.51.100.1' })),
    '127.0.0.1'
  );
  assert.equal(normalizeIp('::ffff:192.0.2.10'), '192.0.2.10');
});
