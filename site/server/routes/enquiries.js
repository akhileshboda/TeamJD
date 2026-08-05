const express = require('express');
const { getClientIp } = require('../middleware/clientIp');
const {
  enquiryAttemptLimiter,
  enquiryEmailLimiter,
  enquiryGlobalLimiter,
  genericApiLimiter
} = require('../middleware/rateLimits');
const { validateEnquiry } = require('../services/enquiryValidation');
const {
  deliverEnquiry,
  getMailConfig,
  isMailConfigured,
  MailProviderError
} = require('../services/mail');
const { getTurnstileConfig, verifyTurnstile } = require('../services/turnstile');

function createEnquiriesRouter(dependencies = {}) {
  const router = express.Router();
  const parseJson = express.json({ limit: '16kb', strict: true });
  const verify = dependencies.verifyTurnstile || verifyTurnstile;
  const deliver = dependencies.deliverEnquiry || deliverEnquiry;

  router.get('/config', genericApiLimiter, (req, res) => {
    const turnstile = getTurnstileConfig();
    const available = Boolean(
      turnstile.siteKey && turnstile.secretKey && isMailConfigured(getMailConfig())
    );

    res.set('Cache-Control', 'no-store');
    return res.json({
      available,
      turnstileSiteKey: turnstile.siteKey || null
    });
  });

  router.post('/', enquiryAttemptLimiter, parseJson, (req, res, next) => {
    if (typeof req.body?.website === 'string' && req.body.website.trim()) {
      return res.status(202).json({ ok: true, message: 'Your enquiry has been received.' });
    }

    return next();
  }, async (req, res, next) => {
    const validation = validateEnquiry(req.body);
    if (!validation.ok) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_ENQUIRY',
          message: 'Check your enquiry details and try again.',
          fields: validation.fields
        }
      });
    }

    const turnstile = await verify({
      token: validation.value.turnstileToken,
      remoteIp: getClientIp(req)
    });

    if (turnstile.unavailable) {
      return res.status(503).json({
        ok: false,
        error: {
          code: 'SECURITY_CHECK_UNAVAILABLE',
          message: 'The security check is temporarily unavailable. Please try again.'
        }
      });
    }
    if (!turnstile.ok) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'SECURITY_CHECK_FAILED',
          message: 'The security check expired or could not be verified. Please try again.'
        }
      });
    }

    return enquiryEmailLimiter(req, res, () => {
      enquiryGlobalLimiter(req, res, async () => {
        try {
          await deliver(validation.value);
          return res.status(202).json({ ok: true, message: 'Your enquiry has been sent.' });
        } catch (error) {
          if (!(error instanceof MailProviderError)) return next(error);

          return res.status(error.unavailable ? 503 : 502).json({
            ok: false,
            error: {
              code: error.unavailable ? 'ENQUIRY_SERVICE_UNAVAILABLE' : 'ENQUIRY_DELIVERY_FAILED',
              message:
                'Your enquiry could not be sent right now. Your details have not been cleared; please try again.'
            }
          });
        }
      });
    });
  });

  return router;
}

module.exports = createEnquiriesRouter();
module.exports.createEnquiriesRouter = createEnquiriesRouter;
