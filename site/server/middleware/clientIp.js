const net = require('net');

function normalizeIp(value) {
  if (typeof value !== 'string') return null;

  const candidate = value.trim();
  if (!candidate || candidate.includes(',')) return null;

  if (candidate.startsWith('::ffff:') && net.isIP(candidate.slice(7)) === 4) {
    return candidate.slice(7);
  }

  return net.isIP(candidate) ? candidate : null;
}

function isLoopback(value) {
  const ip = normalizeIp(value);
  return ip === '127.0.0.1' || ip === '::1';
}

function getClientIp(req) {
  const peerAddress = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  const peerIp = normalizeIp(peerAddress) || 'unknown';

  if (!isLoopback(peerAddress)) {
    return peerIp;
  }

  const cloudflareIp = normalizeIp(req.get?.('CF-Connecting-IP'));
  return cloudflareIp || peerIp;
}

module.exports = { getClientIp, isLoopback, normalizeIp };
