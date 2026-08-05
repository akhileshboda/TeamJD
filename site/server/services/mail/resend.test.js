const assert = require('node:assert/strict');
const test = require('node:test');
const { createResendProvider, MailProviderError, RESEND_BATCH_URL } = require('./resend');

test('Resend adapter sends one idempotent batch without exposing provider choices to the client', async () => {
  let request;
  const provider = createResendProvider({
    apiKey: 'resend-secret',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        json: async () => ({ data: [{ id: 'internal' }, { id: 'customer' }] })
      };
    }
  });
  const messages = [{ to: ['internal@example.com'] }, { to: ['customer@example.com'] }];

  assert.deepEqual(await provider.sendBatch(messages, 'enquiry/submission-id'), { accepted: true });
  assert.equal(request.url, RESEND_BATCH_URL);
  assert.equal(request.options.headers.Authorization, 'Bearer resend-secret');
  assert.equal(request.options.headers['Idempotency-Key'], 'enquiry/submission-id');
  assert.equal(request.options.headers['User-Agent'], 'TeamJD-Enquiries/1.0');
  assert.deepEqual(JSON.parse(request.options.body), messages);
});

test('Resend adapter rejects partial, invalid, and unsuccessful batch responses', async () => {
  const partial = createResendProvider({
    apiKey: 'key',
    fetchImpl: async () => ({ ok: true, json: async () => ({ data: [{ id: 'only-one' }] }) })
  });
  await assert.rejects(
    partial.sendBatch([{}, {}], 'enquiry/id'),
    (error) => error instanceof MailProviderError && error.unavailable === false
  );

  const rejected = createResendProvider({
    apiKey: 'key',
    fetchImpl: async () => ({ ok: false, status: 429 })
  });
  await assert.rejects(rejected.sendBatch([{}, {}], 'enquiry/id'), MailProviderError);
});
