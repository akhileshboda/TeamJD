const assert = require('node:assert/strict');
const test = require('node:test');
const { buildCustomerTemplate, buildInternalTemplate, shortReference } = require('./enquiryTemplates');

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

  assert.match(result.html, /Didn&#39;t send this\? You can safely ignore it/);
  assert.match(result.html, /#FA8072/i);
  assert.match(result.text, /9BF8903C/);
  assert.doesNotMatch(result.html, /alert\(&quot;message&quot;\)/);
  assert.doesNotMatch(result.text, /alert\("message"\)/);
  assert.doesNotMatch(result.text, /within \d+ (hours|days)/i);
  assert.doesNotMatch(result.html, /(tracking|pixel|utm_)/i);
});

test('customer template shows a short reference, Adelaide time and next steps', () => {
  const result = buildCustomerTemplate(enquiry, {
    baseUrl: 'https://team-jd.com.au',
    timestamp: new Date('2026-08-05T05:00:00.000Z')
  });

  assert.equal(shortReference(enquiry.submissionId), '9BF8903C');
  assert.match(result.html, /9BF8903C/);
  assert.match(result.text, /Reference: 9BF8903C/);
  assert.match(result.text, /5 Aug 2026, 2:30\s?pm/i);
  assert.match(result.html, /Thanks, &lt;Akhil&gt;\./);
  assert.match(result.html, /What happens next/);
  assert.match(result.html, /href="https:\/\/team-jd\.com\.au\/results"/);
  assert.match(result.html, /team-jd-logo\.png\?v=2/);
});

test('internal template keeps the full reference and a reply button', () => {
  const result = buildInternalTemplate(enquiry, {
    baseUrl: 'https://team-jd.com.au',
    timestamp: new Date('2026-08-05T05:00:00.000Z')
  });

  assert.match(result.html, /9bf8903c-3ac7-4d29-9538-529d5e1fbf3b/);
  assert.match(result.html, /href="mailto:akhil@example\.com\?subject=/);
  assert.match(result.text, /2026-08-05T05:00:00\.000Z/);
});

test('footer renders https social links and leaves out empty or unsafe ones', () => {
  const withSocial = buildCustomerTemplate(enquiry, {
    baseUrl: 'https://team-jd.com.au',
    social: { instagramUrl: 'https://www.instagram.com/teamjd/', facebookUrl: '' }
  });
  assert.match(withSocial.html, /href="https:\/\/www\.instagram\.com\/teamjd\/"/);
  assert.doesNotMatch(withSocial.html, />Facebook</);

  const unsafe = buildCustomerTemplate(enquiry, {
    baseUrl: 'https://team-jd.com.au',
    social: { instagramUrl: 'javascript:alert(1)' }
  });
  assert.doesNotMatch(unsafe.html, /javascript:/);
  assert.doesNotMatch(unsafe.html, />Instagram</);
});
