const BRAND = Object.freeze({
  accent: '#16c9dd',
  background: '#0d0d0d',
  cta: '#FA8072'
});

// Dark palette matching the site. Every table and cell also gets a bgcolor
// attribute so clients that strip or "fix" CSS colours keep the dark design.
const EMAIL = Object.freeze({
  page: '#0a0a0a',
  card: '#141414',
  panel: '#1b1b1b',
  border: '#262626',
  heading: '#ffffff',
  text: '#d4d8d9',
  muted: '#8a9192',
  font: "Manrope,'Segoe UI',Helvetica,Arial,sans-serif"
});

// Bump when the logo file changes: Gmail's image proxy caches by URL.
const LOGO_VERSION = 2;

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

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch (_error) {
    return false;
  }
}

// The first block of the UUID is enough for a person to quote back; the full
// ID stays in the internal email for searching logs.
function shortReference(submissionId) {
  return String(submissionId || '').split('-')[0].toUpperCase();
}

function formatAdelaideTime(date) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Adelaide',
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function footerLinks(baseUrl, social = {}) {
  const links = [
    isHttpsUrl(social.instagramUrl) && ['Instagram', social.instagramUrl],
    isHttpsUrl(social.facebookUrl) && ['Facebook', social.facebookUrl],
    ['Website', baseUrl],
    ['Privacy', `${baseUrl}/privacy`]
  ].filter(Boolean);

  return links
    .map(([label, href]) => `<a href="${escapeHtml(href)}" style="color:${EMAIL.text};text-decoration:none;font-weight:600;">${label}</a>`)
    .join(`<span style="color:#4a5051;">&nbsp;&nbsp;/&nbsp;&nbsp;</span>`);
}

function frame({ baseUrl, preheader, eyebrow, heading, content, social }) {
  const safeBaseUrl = escapeHtml(normalizeBaseUrl(baseUrl));
  const logoUrl = `${safeBaseUrl}/assets/branding/team-jd-logo.png?v=${LOGO_VERSION}`;
  const eyebrowHtml = eyebrow
    ? `<p style="margin:0 0 14px;color:${BRAND.accent};font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">${escapeHtml(eyebrow)}</p>`
    : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>${escapeHtml(heading)}</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;800&display=swap" rel="stylesheet">
<style>:root{color-scheme:dark light;}@media (max-width:620px){.jd-pad{padding-left:22px !important;padding-right:22px !important;}.jd-h1{font-size:28px !important;}}</style></head>
<body style="margin:0;padding:0;background:${EMAIL.page};color:${EMAIL.text};font-family:${EMAIL.font};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${EMAIL.page}" style="background:${EMAIL.page};"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${EMAIL.card}" style="max-width:600px;background:${EMAIL.card};border:1px solid ${EMAIL.border};border-collapse:separate;border-radius:16px;overflow:hidden;">
<tr><td class="jd-pad" bgcolor="${BRAND.background}" style="background:${BRAND.background};padding:28px 40px;border-bottom:3px solid ${BRAND.accent};"><a href="${safeBaseUrl}" style="text-decoration:none;"><img src="${logoUrl}" width="140" height="65" alt="Team JD" style="display:block;width:140px;height:auto;border:0;"></a></td></tr>
<tr><td class="jd-pad" bgcolor="${EMAIL.card}" style="padding:44px 40px 40px;">${eyebrowHtml}<h1 class="jd-h1" style="margin:0 0 20px;color:${EMAIL.heading};font-size:32px;line-height:1.15;font-weight:800;letter-spacing:-0.5px;">${escapeHtml(heading)}</h1>${content}</td></tr>
<tr><td class="jd-pad" bgcolor="${BRAND.background}" style="background:${BRAND.background};padding:26px 40px;border-top:1px solid ${EMAIL.border};font-size:13px;line-height:1.7;">
<p style="margin:0 0 6px;">${footerLinks(safeBaseUrl, social)}</p>
<p style="margin:0;color:${EMAIL.muted};font-size:12px;">Team JD &middot; Coaching by Jake Dedert &middot; Adelaide, Australia</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function paragraph(html, extra = '') {
  return `<p style="margin:0 0 16px;color:${EMAIL.text};font-size:16px;line-height:1.7;${extra}">${html}</p>`;
}

function detailsRow(label, value, valueStyle = '') {
  return `<tr><td style="padding:10px 18px;color:${EMAIL.muted};font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;width:96px;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:10px 18px;color:${EMAIL.heading};font-size:15px;line-height:1.5;vertical-align:top;${valueStyle}">${escapeHtml(value)}</td></tr>`;
}

function detailsPanel(rows) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${EMAIL.panel}" style="margin:28px 0;border-collapse:separate;background:${EMAIL.panel};border:1px solid ${EMAIL.border};border-radius:10px;"><tr><td style="padding:8px 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table></td></tr></table>`;
}

function button(href, label) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:separate;"><tr><td bgcolor="${BRAND.cta}" style="border-radius:8px;background:${BRAND.cta};"><a href="${escapeHtml(href)}" style="display:inline-block;padding:15px 26px;color:#111111;font-size:15px;font-weight:800;text-decoration:none;border-radius:8px;">${escapeHtml(label)} &rarr;</a></td></tr></table>`;
}

function stepRow(number, html) {
  return `<tr><td style="padding:12px 0;width:44px;vertical-align:top;color:${BRAND.accent};font-size:13px;font-weight:800;letter-spacing:1px;border-top:1px solid ${EMAIL.border};">${number}</td><td style="padding:12px 0;vertical-align:top;color:${EMAIL.text};font-size:15px;line-height:1.6;border-top:1px solid ${EMAIL.border};">${html}</td></tr>`;
}

const REFERENCE_STYLE = "font-family:'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:2px;";

function buildInternalTemplate(enquiry, options) {
  const fullName = [enquiry.firstName, enquiry.lastName].filter(Boolean).join(' ');
  const timestamp = options.timestamp.toISOString();
  const localTime = formatAdelaideTime(options.timestamp);
  const replyHref = `mailto:${enquiry.email}?subject=${encodeURIComponent('Re: your Team JD enquiry')}`;
  const content = `${paragraph('A new general enquiry came in through the Team JD website. Reply to this email to answer them directly.')}
${detailsPanel(`${detailsRow('Name', fullName)}${detailsRow('Email', enquiry.email)}${detailsRow('Interest', enquiry.serviceLabel)}${detailsRow('Submitted', localTime)}${detailsRow('Reference', enquiry.submissionId, `font-size:13px;color:${EMAIL.muted};`)}`)}
<p style="margin:0 0 10px;color:${EMAIL.muted};font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;">Message</p>
<div style="white-space:pre-wrap;margin:0 0 28px;padding:18px 20px;background:${EMAIL.panel};color:${EMAIL.heading};font-size:15px;line-height:1.7;border-radius:10px;">${escapeHtml(enquiry.message)}</div>
${button(replyHref, `Reply to ${enquiry.firstName}`)}`;

  return {
    html: frame({
      baseUrl: options.baseUrl,
      preheader: `New enquiry from ${fullName}`,
      eyebrow: 'Website enquiry',
      heading: `New enquiry from ${fullName}`,
      content,
      social: options.social
    }),
    text: `New Team JD website enquiry\n\nName: ${fullName}\nEmail: ${enquiry.email}\nInterest: ${enquiry.serviceLabel}\nSubmitted: ${localTime} (${timestamp})\nReference: ${enquiry.submissionId}\n\nMessage:\n${enquiry.message}`
  };
}

function buildCustomerTemplate(enquiry, options) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const reference = shortReference(enquiry.submissionId);
  const sentAt = formatAdelaideTime(options.timestamp || new Date());
  const content = `${paragraph('Your message is with Jake. Here are the details for your records.', 'font-size:17px;')}
${detailsPanel(`${detailsRow('Topic', enquiry.serviceLabel)}${detailsRow('Sent', sentAt)}${detailsRow('Reference', reference, REFERENCE_STYLE)}`)}
<p style="margin:0 0 6px;color:${EMAIL.heading};font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">What happens next</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 32px;">
${stepRow('01', "Your enquiry is in Jake&#39;s inbox.")}
${stepRow('02', `Jake will reply to <strong style="color:${EMAIL.heading};">${escapeHtml(enquiry.email)}</strong>.`)}
${stepRow('03', 'Want to add something? Just reply to this email.')}
</table>
${paragraph('While you wait, see what clients have achieved with Jake.', 'margin-bottom:20px;')}
${button(`${baseUrl}/results`, 'See client results')}
<p style="margin:18px 0 0;font-size:14px;"><a href="${escapeHtml(baseUrl)}/services" style="color:${BRAND.accent};text-decoration:none;font-weight:700;">Explore services &rarr;</a></p>
<p style="margin:36px 0 0;padding-top:20px;border-top:1px solid ${EMAIL.border};color:${EMAIL.muted};font-size:13px;line-height:1.6;">Didn&#39;t send this? You can safely ignore it.</p>`;

  return {
    html: frame({
      baseUrl,
      preheader: `Your message is with Jake. Reference ${reference}.`,
      eyebrow: 'Enquiry received',
      heading: `Thanks, ${enquiry.firstName}.`,
      content,
      social: options.social
    }),
    text: `Thanks, ${enquiry.firstName}.\n\nYour message is with Jake. Here are the details for your records.\n\nTopic: ${enquiry.serviceLabel}\nSent: ${sentAt}\nReference: ${reference}\n\nWhat happens next\n01 Your enquiry is in Jake's inbox.\n02 Jake will reply to ${enquiry.email}.\n03 Want to add something? Just reply to this email.\n\nSee client results: ${baseUrl}/results\nExplore services: ${baseUrl}/services\n\nDidn't send this? You can safely ignore it.`
  };
}

function buildSignInCodeTemplate({ code, baseUrl }) {
  const content = `${paragraph('Use this code to sign in to your Team JD dashboard:')}
<p style="margin:8px 0 24px;padding:18px 0;background:${EMAIL.panel};border-radius:10px;text-align:center;color:${EMAIL.heading};font-size:34px;font-weight:800;letter-spacing:8px;font-family:'SFMono-Regular',Menlo,Consolas,monospace;">${escapeHtml(code)}</p>
${paragraph('It works once and expires in 10 minutes.')}
<p style="margin:28px 0 0;padding-top:20px;border-top:1px solid ${EMAIL.border};color:${EMAIL.muted};font-size:13px;line-height:1.6;">If you did not try to sign in, you can ignore this email. Nobody can sign in without the code.</p>`;

  return {
    html: frame({ baseUrl, preheader: `Your sign-in code is ${code}`, eyebrow: 'Dashboard', heading: 'Your sign-in code', content }),
    text: `Your Team JD dashboard sign-in code is ${code}\n\nIt works once and expires in 10 minutes.\n\nIf you did not try to sign in, you can ignore this email.`
  };
}

module.exports = {
  BRAND,
  buildCustomerTemplate,
  buildInternalTemplate,
  buildSignInCodeTemplate,
  escapeHtml,
  shortReference
};
