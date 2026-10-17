const express = require('express');
const { pageViewLimiter } = require('../middleware/rateLimits');
const { getAdmin } = require('../middleware/adminAuth');
const { getAnalytics } = require('../services/analytics');

// POST /api/analytics/pv — page-view beacon from the public site. Always answers
// 204 so the beacon never retries or surfaces errors to visitors.

function createAnalyticsRouter({ analytics = getAnalytics(), env } = {}) {
  const router = express.Router();
  // sendBeacon may arrive as text/plain; parse either as JSON.
  const parseBeacon = express.json({ limit: '2kb', type: ['application/json', 'text/plain'] });

  router.post('/pv', pageViewLimiter, parseBeacon, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    // Jake and Akhil browsing their own site should not inflate the numbers.
    if (getAdmin(req, env)) return res.status(204).end();
    try {
      const siteHost = String(req.get('host') || '').split(':')[0].replace(/^www\./, '').toLowerCase();
      await analytics.record({
        path: req.body?.path,
        referrer: req.body?.referrer,
        utmSource: req.body?.utmSource,
        visitStart: req.body?.visitStart === true,
        userAgent: req.get('user-agent') || '',
        siteHost
      });
    } catch (error) {
      console.error('[analytics] page view not recorded:', error.message);
    }
    return res.status(204).end();
  });

  // Malformed or oversized beacons are dropped quietly, like any other rejected view.
  router.use((error, req, res, _next) => res.status(204).end());

  return router;
}

module.exports = { createAnalyticsRouter };
