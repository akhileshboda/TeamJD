const path = require('path');
const { logVisit } = require('../services/visitLog');
const { getClientIp } = require('./clientIp');

function isPageView(req) {
  if (req.method !== 'GET') return false;
  const ext = path.extname(req.path);
  if (ext && ext !== '.html') return false;
  return Boolean(req.accepts('html'));
}

function visitLogger(req, res, next) {
  if (isPageView(req)) {
    logVisit({
      type: 'visit',
      ip: getClientIp(req),
      method: req.method,
      path: req.originalUrl || req.url,
      ua: req.get('user-agent') || null
    });
  }

  next();
}

module.exports = { isPageView, visitLogger };
