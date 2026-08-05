const RESEND_BATCH_URL = 'https://api.resend.com/emails/batch';

class MailProviderError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'MailProviderError';
    this.unavailable = options.unavailable || false;
  }
}

function createResendProvider({ apiKey, fetchImpl = global.fetch } = {}) {
  if (!apiKey || typeof fetchImpl !== 'function') {
    throw new MailProviderError('Resend is not configured.', { unavailable: true });
  }

  return {
    async sendBatch(messages, idempotencyKey) {
      let response;

      try {
        response = await fetchImpl(RESEND_BATCH_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
            'User-Agent': 'TeamJD-Enquiries/1.0'
          },
          body: JSON.stringify(messages),
          signal: AbortSignal.timeout(10000)
        });
      } catch (_error) {
        throw new MailProviderError('Resend could not be reached.', { unavailable: true });
      }

      if (!response.ok) {
        throw new MailProviderError('Resend rejected the email batch.');
      }

      const payload = await response.json().catch(() => null);
      const accepted =
        Array.isArray(payload?.data) &&
        payload.data.length === messages.length &&
        payload.data.every((email) => typeof email?.id === 'string' && email.id);

      if (!accepted) {
        throw new MailProviderError('Resend returned an invalid batch response.');
      }

      return { accepted: true };
    }
  };
}

module.exports = { createResendProvider, MailProviderError, RESEND_BATCH_URL };
