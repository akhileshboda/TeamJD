const BRAND = Object.freeze({
  accent: '#16c9dd',
  background: '#0d0d0d',
  cta: '#FA8072'
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeBaseUrl(value) {
  try {
    const url = new URL(value || 'https://team-jd.com.au');
    return `${url.protocol}//${url.host}`;
  } catch (_error) {
    return 'https://team-jd.com.au';
  }
}

function frame({ baseUrl, preheader, heading, content }) {
  const safeBaseUrl = escapeHtml(normalizeBaseUrl(baseUrl));
  const logoUrl = `${safeBaseUrl}/assets/branding/team-jd-logo.png`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;background:#f2f4f5;color:#16191a;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f4f5;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-collapse:collapse;border-radius:12px;overflow:hidden;">
<tr><td style="background:${BRAND.background};padding:24px 32px;border-bottom:4px solid ${BRAND.accent};"><a href="${safeBaseUrl}" style="text-decoration:none;"><img src="${logoUrl}" width="154" alt="Team JD" style="display:block;width:154px;height:auto;border:0;"></a></td></tr>
<tr><td style="padding:36px 32px;"><h1 style="margin:0 0 22px;color:#101314;font-size:28px;line-height:1.2;">${escapeHtml(heading)}</h1>${content}</td></tr>
<tr><td style="padding:22px 32px;background:#eef2f3;color:#586164;font-size:12px;line-height:1.6;">Team JD · Adelaide, Australia<br><a href="${safeBaseUrl}" style="color:#087f8c;">${safeBaseUrl}</a></td></tr>
</table></td></tr></table></body></html>`;
}

function detailsRow(label, value) {
  return `<tr><td style="padding:9px 12px;color:#697174;width:130px;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:9px 12px;color:#15191a;vertical-align:top;">${escapeHtml(value)}</td></tr>`;
}

function buildInternalTemplate(enquiry, options) {
  const fullName = [enquiry.firstName, enquiry.lastName].filter(Boolean).join(' ');
  const timestamp = options.timestamp.toISOString();
  const content = `<p style="margin:0 0 20px;line-height:1.7;">A new general enquiry was submitted through the Team JD website.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f7f9f9;border-left:4px solid ${BRAND.accent};">
${detailsRow('Name', fullName)}${detailsRow('Email', enquiry.email)}${detailsRow('Interest', enquiry.serviceLabel)}${detailsRow('Submitted', timestamp)}${detailsRow('Reference', enquiry.submissionId)}
</table>
<h2 style="margin:28px 0 10px;font-size:17px;color:#101314;">Message</h2>
<div style="white-space:pre-wrap;padding:16px;background:#f7f9f9;line-height:1.7;border-radius:6px;">${escapeHtml(enquiry.message)}</div>`;

  return {
    html: frame({ baseUrl: options.baseUrl, preheader: `New enquiry from ${fullName}`, heading: 'New website enquiry', content }),
    text: `New Team JD website enquiry\n\nName: ${fullName}\nEmail: ${enquiry.email}\nInterest: ${enquiry.serviceLabel}\nSubmitted: ${timestamp}\nReference: ${enquiry.submissionId}\n\nMessage:\n${enquiry.message}`
  };
}

function buildCustomerTemplate(enquiry, options) {
  const safeBaseUrl = escapeHtml(normalizeBaseUrl(options.baseUrl));
  const content = `<p style="margin:0 0 16px;line-height:1.7;">Hi ${escapeHtml(enquiry.firstName)},</p>
<p style="margin:0 0 16px;line-height:1.7;">Thanks for getting in touch. Your enquiry has been sent to Team JD.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;border-collapse:collapse;background:#f7f9f9;border-left:4px solid ${BRAND.accent};">${detailsRow('Interest', enquiry.serviceLabel)}${detailsRow('Reference', enquiry.submissionId)}</table>
<p style="margin:0 0 24px;line-height:1.7;">Keep the reference above if you need to follow up about this submission.</p>
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="border-radius:6px;background:${BRAND.cta};"><a href="${safeBaseUrl}" style="display:inline-block;padding:13px 22px;color:#111;text-decoration:none;font-weight:bold;">Visit Team JD</a></td></tr></table>
<p style="margin:28px 0 0;padding-top:18px;border-top:1px solid #dce2e3;color:#697174;font-size:13px;line-height:1.6;">If you did not submit this enquiry, you can ignore this message.</p>`;

  return {
    html: frame({ baseUrl: options.baseUrl, preheader: 'Your Team JD enquiry has been sent.', heading: 'We received your enquiry', content }),
    text: `Hi ${enquiry.firstName},\n\nThanks for getting in touch. Your enquiry has been sent to Team JD.\n\nInterest: ${enquiry.serviceLabel}\nReference: ${enquiry.submissionId}\n\nVisit Team JD: ${normalizeBaseUrl(options.baseUrl)}\n\nIf you did not submit this enquiry, you can ignore this message.`
  };
}

module.exports = { BRAND, buildCustomerTemplate, buildInternalTemplate, escapeHtml };
