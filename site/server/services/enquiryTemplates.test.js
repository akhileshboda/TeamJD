const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildCustomerTemplate,
  buildInternalTemplate,
  customerMailto,
  formatAdelaideTimestamp
} = require('./enquiryTemplates');

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
    timestamp: new Date('2026-08-05T05:00:00.000Z')
  });

  assert.match(result.html, /#16c9dd/i);
  assert.match(result.html, /#FA8072/i);
  assert.match(result.html, /Email &lt;Akhil&gt;/i);
  assert.match(result.html, /mailto:akhil%40example\.com\?subject=Re%3A%20Your%20Team%20JD%20enquiry/i);
  assert.match(result.html, />akhil@example\.com</i);
  assert.match(result.text, /Email <Akhil>: mailto:akhil%40example\.com/i);
  assert.match(result.text, /Wednesday,? 5 August 2026/i);
  assert.doesNotMatch(result.html, /<img|https?:\/\//i);
  assert.doesNotMatch(result.html, /<script>/i);
  assert.match(result.html, /&lt;script&gt;/i);
  assert.match(result.text, /alert\("message"\)/);
});

test('customer template uses the energetic mobile-first hierarchy without echoing the message', () => {
  const result = buildCustomerTemplate(enquiry, { baseUrl: 'https://team-jd.com.au' });

  assert.match(result.html, /ENQUIRY RECEIVED/);
  assert.match(result.html, /Thanks, &lt;Akhil&gt;\./);
  assert.match(result.html, /We&rsquo;ve got your enquiry/);
  assert.match(result.html, /You asked about/);
  assert.match(result.html, /What happens next/);
  assert.match(result.html, /simply reply to this email/i);
  assert.match(result.html, /If you did not submit this enquiry/i);
  assert.match(result.html, /assets\/branding\/team-jd-logo\.png/);
  assert.match(result.html, /width="600"/);
  assert.match(result.html, /max-width:620px/);
  assert.match(result.html, /bgcolor="#ffffff"/i);
  assert.match(result.html, /#16c9dd/i);
  assert.match(result.html, /#FA8072/i);
  assert.match(result.text, /What happens next/);
  assert.match(result.text, /Online Coaching/);
  assert.match(result.text, /9bf8903c-3ac7-4d29-9538-529d5e1fbf3b/);
  assert.doesNotMatch(result.html, /Visit Team JD/i);
  assert.doesNotMatch(result.html, /alert\(&quot;message&quot;\)/);
  assert.doesNotMatch(result.text, /alert\("message"\)/);
  assert.doesNotMatch(result.text, /within \d+ (hours|days)/i);
  assert.doesNotMatch(result.html, /(tracking|pixel|utm_)/i);
});

test('customer links use the dedicated public email base URL origin only', () => {
  const result = buildCustomerTemplate(enquiry, {
    baseUrl: 'https://team-jd.com.au/untrusted/path?query=value'
  });

  assert.match(result.html, /https:\/\/team-jd\.com\.au\/assets\/branding\/team-jd-logo\.png/);
  assert.doesNotMatch(result.html, /untrusted|query=value/);
  assert.match(result.text, /https:\/\/team-jd\.com\.au/);
});

test('customer contact helpers encode mail links and use Adelaide local time', () => {
  assert.equal(
    customerMailto('customer+prep@example.com'),
    'mailto:customer%2Bprep%40example.com?subject=Re%3A%20Your%20Team%20JD%20enquiry'
  );
  assert.match(
    formatAdelaideTimestamp(new Date('2026-08-07T12:38:54.791Z')),
    /Friday,? 7 August 2026 at 10:08 pm ACST/i
  );
});
