const path = require('path');
const { logVisit } = require('../services/visitLog');

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
      ip: req.ip,
      method: req.method,
      path: req.originalUrl || req.url,
      ua: req.get('user-agent') || null
    });
  }

  next();
}

module.exports = { isPageView, visitLogger };
