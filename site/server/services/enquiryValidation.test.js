const assert = require('node:assert/strict');
const test = require('node:test');
const { validateEnquiry } = require('./enquiryValidation');

const valid = {
  firstName: 'Akhil',
  lastName: 'Boda',
  email: 'Akhil@example.com',
  service: 'online-coaching',
  message: 'I would like to learn more.',
  submissionId: '9bf8903c-3ac7-4d29-9538-529d5e1fbf3b',
  website: '',
  turnstileToken: 'verified-token'
};

test('normalizes and validates an enquiry', () => {
  const result = validateEnquiry(valid);
  assert.equal(result.ok, true);
  assert.equal(result.value.email, 'akhil@example.com');
  assert.equal(result.value.serviceLabel, 'Online Coaching');
});

test('rejects bounds, unknown services, invalid UUIDs, and missing security tokens', () => {
  const result = validateEnquiry({
    ...valid,
    firstName: 'a'.repeat(101),
    lastName: 'b'.repeat(101),
    email: 'invalid',
    service: 'attacker-chosen',
    message: 'm'.repeat(5001),
    submissionId: 'not-a-uuid',
    turnstileToken: ''
  });

  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.fields).sort(), [
    'email', 'firstName', 'lastName', 'message', 'service', 'submissionId', 'turnstileToken'
  ].sort());
});

test('rejects CR/LF injection in values used in email headers', () => {
  assert.equal(validateEnquiry({ ...valid, firstName: 'Akhil\r\nBcc: attacker@example.com' }).ok, false);
  assert.equal(validateEnquiry({ ...valid, email: 'victim@example.com\nBcc: attacker@example.com' }).ok, false);
  assert.equal(validateEnquiry({ ...valid, message: 'Line one\nLine two' }).ok, true);
});

test('bounds Turnstile tokens to Cloudflare maximum length', () => {
  const result = validateEnquiry({ ...valid, turnstileToken: 't'.repeat(2049) });
  assert.equal(result.ok, false);
  assert.ok(result.fields.turnstileToken);
});
