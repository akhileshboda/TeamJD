const assert = require('node:assert/strict');
const test = require('node:test');
const { buildCustomerTemplate, buildInternalTemplate } = require('./enquiryTemplates');

const enquiry = {
  firstName: '<Akhil>',
  lastName: 'Boda',
  email: 'akhil@example.com',
  serviceLabel: 'Online Coaching',
  message: '<script>alert("message")</script>',
  submissionId: '9bf8903c-3ac7-4d29-9538-529d5e1fbf3b'
};

test('internal template includes escaped enquiry details and Team JD branding', () => {
  const result = buildInternalTemplate(enquiry, {
    baseUrl: 'https://team-jd.com.au',
    timestamp: new Date('2026-08-05T05:00:00.000Z')
  });

  assert.match(result.html, /#16c9dd/i);
  assert.match(result.html, /assets\/branding\/team-jd-logo\.png/);
  assert.doesNotMatch(result.html, /<script>/i);
  assert.match(result.html, /&lt;script&gt;/i);
  assert.match(result.text, /alert\("message"\)/);
});

test('customer template does not echo the message or promise a response time', () => {
  const result = buildCustomerTemplate(enquiry, { baseUrl: 'https://team-jd.com.au' });

  assert.match(result.html, /If you did not submit this enquiry/i);
  assert.match(result.html, /#FA8072/i);
  assert.match(result.text, /9bf8903c-3ac7-4d29-9538-529d5e1fbf3b/);
  assert.doesNotMatch(result.html, /alert\(&quot;message&quot;\)/);
  assert.doesNotMatch(result.text, /alert\("message"\)/);
  assert.doesNotMatch(result.text, /within \d+ (hours|days)/i);
  assert.doesNotMatch(result.html, /(tracking|pixel|utm_)/i);
});
