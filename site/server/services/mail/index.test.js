const assert = require('node:assert/strict');
const test = require('node:test');
const { deliverEnquiry, getMailConfig, isMailConfigured, MailProviderError } = require('./index');

function withEnv(run) {
  const values = {
    ENQUIRY_MAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 'resend-key',
    ENQUIRY_EMAIL_FROM: 'Jake at Team JD <enquiries@send.team-jd.com.au>',
    ENQUIRY_EMAIL_PUBLIC_BASE_URL: 'https://team-jd.com.au',
    ENQUIRY_NOTIFICATION_TO: 'akhileshboda@outlook.com',
    ENQUIRY_REPLY_TO: 'akhileshboda@outlook.com',
    ENQUIRY_EMAIL_SUBJECT_PREFIX: '[STAGING]',
    PUBLIC_BASE_URL: 'https://staging.team-jd.com.au'
  };
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  return Promise.resolve(run()).finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

const enquiry = {
  firstName: 'Akhil',
  lastName: 'Boda',
  email: 'customer@example.com',
  serviceLabel: 'Online Coaching',
  message: 'Full internal message',
  submissionId: '9bf8903c-3ac7-4d29-9538-529d5e1fbf3b'
};

test('delivery fixes the internal recipient and reply-to values on the server', async () => withEnv(async () => {
  let batch;
  const provider = {
    async sendBatch(messages, idempotencyKey) {
      batch = { messages, idempotencyKey };
      return { accepted: true };
    }
  };

  await deliverEnquiry(enquiry, {
    provider,
    timestamp: new Date('2026-08-05T05:00:00.000Z')
  });

  assert.equal(batch.idempotencyKey, `enquiry/${enquiry.submissionId}`);
  assert.equal(batch.messages.length, 2);
  assert.deepEqual(batch.messages[0].to, ['akhileshboda@outlook.com']);
  assert.equal(Object.hasOwn(batch.messages[0], 'reply_to'), false);
  assert.deepEqual(batch.messages[1].to, ['customer@example.com']);
  assert.equal(batch.messages[1].reply_to, 'akhileshboda@outlook.com');
  assert.equal(batch.messages[0].from, 'Jake at Team JD <enquiries@send.team-jd.com.au>');
  assert.equal(batch.messages[1].from, 'Jake at Team JD <enquiries@send.team-jd.com.au>');
  assert.match(batch.messages[0].subject, /^\[STAGING\]/);
  assert.match(batch.messages[1].subject, /^\[STAGING\]/);
  assert.match(batch.messages[0].text, /Full internal message/);
  assert.match(batch.messages[0].html, /mailto:customer%40example\.com/);
  assert.match(batch.messages[0].html, />customer@example\.com</);
  assert.match(batch.messages[0].html, /https:\/\/team-jd\.com\.au\/assets\/branding\/team-jd-logo\.png/);
  assert.doesNotMatch(batch.messages[0].html, /staging\.team-jd\.com\.au/);
  assert.match(batch.messages[1].html, /https:\/\/team-jd\.com\.au\/assets\/branding\/team-jd-logo\.png/);
  assert.doesNotMatch(batch.messages[1].html, /staging\.team-jd\.com\.au/);
  assert.match(batch.messages[1].text, /Full internal message/);
  assert.equal(Object.hasOwn(batch.messages[0], 'attachments'), false);
}));

test('unsupported providers fail closed instead of silently falling back', async () => withEnv(async () => {
  process.env.ENQUIRY_MAIL_PROVIDER = 'google';
  assert.equal(isMailConfigured(getMailConfig()), false);
  await assert.rejects(
    deliverEnquiry(enquiry),
    (error) => error instanceof MailProviderError && error.unavailable === true
  );
}));
