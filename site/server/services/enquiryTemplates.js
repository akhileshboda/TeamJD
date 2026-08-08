const BRAND = Object.freeze({
  accent: '#16c9dd',
  accentDark: '#0b8b98',
  accentTint: '#e6f9fb',
  cta: '#fa8072',
  ctaDark: '#dd5f52',
  ctaTint: '#fff1ee',
  ink: '#15191a',
  body: '#3a4245',
  muted: '#6b7477',
  border: '#e5e9ea',
  background: '#0e1113',
  surface: '#f2f5f5',
  card: '#f8fafa'
});

const FONT_STACK = "'Manrope',Arial,Helvetica,sans-serif";
const SHELL_WIDTH = 600;

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

function formatAdelaideTimestamp(value) {
  const timestamp = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Adelaide',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(timestamp);
}

function customerMailto(email) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Re: Your Team JD enquiry')}`;
}

function documentHead({ title, mobileHeadingSize = '25px' }) {
  return `<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
<style>
body,table,td,a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
@media only screen and (max-width:620px) {
  .email-shell { width:100% !important; }
  .mobile-pad { padding-left:26px !important; padding-right:26px !important; }
  .hero-title { font-size:${mobileHeadingSize} !important; line-height:1.25 !important; }
  .mobile-button { display:block !important; width:auto !important; text-align:center !important; }
}
</style>
</head>`;
}

function preheader(value) {
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(value)}</div>`;
}

function gradientRule({ width = '100%' } = {}) {
  return `<table role="presentation" width="${width}" cellspacing="0" cellpadding="0" style="width:${width};border-collapse:collapse;"><tr><td height="3" bgcolor="${BRAND.cta}" style="height:3px;line-height:3px;font-size:0;border-radius:2px;background-color:${BRAND.cta};background-image:linear-gradient(90deg,${BRAND.accent} 0%,${BRAND.cta} 100%);">&nbsp;</td></tr></table>`;
}

function emailHeader({ safeBaseUrl }) {
  const logoUrl = `${safeBaseUrl}/assets/branding/team-jd-logo.png`;
  return `<tr><td bgcolor="#ffffff" class="mobile-pad" style="padding:30px 36px 0;background:#ffffff;text-align:center;">
<a href="${safeBaseUrl}" style="text-decoration:none;"><img src="${logoUrl}" width="146" alt="Team JD — Jake Dedert" style="display:inline-block;width:146px;max-width:55%;height:auto;border:0;"></a>
</td></tr>
<tr><td bgcolor="#ffffff" class="mobile-pad" style="padding:16px 36px 0;background:#ffffff;">${gradientRule()}</td></tr>`;
}

function ctaButton({ href, label }) {
  return `<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="${BRAND.cta}" style="background-color:${BRAND.cta};background-image:linear-gradient(90deg,${BRAND.accent} -30%,${BRAND.cta} 65%);border-radius:8px;"><a href="${escapeHtml(href)}" class="mobile-button" style="display:inline-block;padding:14px 26px;color:${BRAND.ink};text-decoration:none;font-family:${FONT_STACK};font-size:14px;line-height:1.3;font-weight:800;border-radius:8px;">${escapeHtml(label)}</a></td></tr></table>`;
}

function detailRow(label, value, options = {}) {
  const renderedValue = options.href
    ? `<a href="${escapeHtml(options.href)}" style="color:${BRAND.accentDark};text-decoration:none;font-weight:700;word-break:break-word;">${escapeHtml(value)}</a>`
    : `<span style="color:${BRAND.ink};font-weight:700;">${escapeHtml(value)}</span>`;

  return `<tr>
<td style="padding:11px 0;border-bottom:1px solid ${BRAND.border};width:96px;color:${BRAND.muted};font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;vertical-align:top;">${escapeHtml(label)}</td>
<td style="padding:11px 0;border-bottom:1px solid ${BRAND.border};font-family:${FONT_STACK};font-size:14.5px;line-height:1.5;vertical-align:top;">${renderedValue}</td>
</tr>`;
}

function detailsCard(rows) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${BRAND.card}" style="width:100%;border-collapse:collapse;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:10px;"><tr><td style="padding:4px 18px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
${rows.join('\n')}
</table>
</td></tr></table>`;
}

function messageQuote(message, { heading = 'Message' } = {}) {
  return `<div style="margin:0 0 8px;color:${BRAND.muted};font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;">${escapeHtml(heading)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${BRAND.accentTint}" style="width:100%;border-collapse:collapse;background:${BRAND.accentTint};border-radius:10px;"><tr><td style="padding:16px 18px;border-left:3px solid ${BRAND.accent};border-radius:10px;color:${BRAND.ink};font-family:${FONT_STACK};font-size:14.5px;line-height:1.7;white-space:pre-wrap;word-break:break-word;">${escapeHtml(message)}</td></tr></table>`;
}

function heroPanel({ eyebrow, title, subtitleHtml }) {
  return `<tr><td bgcolor="${BRAND.background}" class="mobile-pad" style="padding:34px 36px 36px;background:${BRAND.background};margin-top:22px;">
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;"><tr>
<td width="32" height="32" bgcolor="${BRAND.accent}" style="width:32px;height:32px;border-radius:16px;background-color:${BRAND.accent};text-align:center;font-family:${FONT_STACK};font-size:16px;line-height:32px;font-weight:800;color:${BRAND.background};">&#10003;</td>
</tr></table>
<div style="margin:0 0 10px;color:${BRAND.accent};font-family:${FONT_STACK};font-size:11px;line-height:1.4;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;">${escapeHtml(eyebrow)}</div>
<h1 class="hero-title" style="margin:0 0 10px;color:#ffffff;font-family:${FONT_STACK};font-size:27px;line-height:1.25;font-weight:800;">${title}</h1>
<p style="margin:0;color:#b7c0c2;font-family:${FONT_STACK};font-size:15px;line-height:1.65;">${subtitleHtml}</p>
</td></tr>`;
}

function buildInternalTemplate(enquiry, options) {
  const fullName = [enquiry.firstName, enquiry.lastName].filter(Boolean).join(' ');
  const submittedAt = formatAdelaideTimestamp(options.timestamp);
  const mailto = customerMailto(enquiry.email);
  const safeBaseUrl = escapeHtml(normalizeBaseUrl(options.baseUrl));

  const html = `<!doctype html>
<html lang="en">${documentHead({ title: 'New Team JD website enquiry', mobileHeadingSize: '23px' })}
<body style="margin:0;padding:0;background:${BRAND.surface};color:${BRAND.ink};font-family:${FONT_STACK};-webkit-text-size-adjust:100%;">
${preheader(`New enquiry from ${fullName} — ${enquiry.serviceLabel}`)}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${BRAND.surface}" style="width:100%;border-collapse:collapse;background:${BRAND.surface};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="${SHELL_WIDTH}" cellspacing="0" cellpadding="0" bgcolor="#ffffff" class="email-shell" style="width:${SHELL_WIDTH}px;max-width:${SHELL_WIDTH}px;border-collapse:collapse;background:#ffffff;border-radius:14px;overflow:hidden;">
${emailHeader({ safeBaseUrl })}
${heroPanel({
  eyebrow: 'New Enquiry',
  title: `${escapeHtml(fullName)} wants to talk about ${escapeHtml(enquiry.serviceLabel)}`,
  subtitleHtml: "Here's what came through the Team JD contact form."
})}
<tr><td bgcolor="#ffffff" class="mobile-pad" style="padding:30px 36px 0;background:#ffffff;">
${detailsCard([
  detailRow('Name', fullName),
  detailRow('Email', enquiry.email, { href: mailto }),
  detailRow('Interest', enquiry.serviceLabel),
  detailRow('Submitted', submittedAt)
])}
</td></tr>
<tr><td bgcolor="#ffffff" class="mobile-pad" style="padding:22px 36px 8px;background:#ffffff;">
${messageQuote(enquiry.message)}
</td></tr>
<tr><td bgcolor="#ffffff" class="mobile-pad" style="padding:24px 36px 32px;background:#ffffff;">
${ctaButton({ href: mailto, label: `Reply to ${enquiry.firstName}` })}
</td></tr>
<tr><td bgcolor="${BRAND.surface}" class="mobile-pad" style="padding:16px 36px;background:${BRAND.surface};color:${BRAND.muted};font-family:${FONT_STACK};font-size:11.5px;line-height:1.6;word-break:break-all;border-top:1px solid ${BRAND.border};">Reference ${escapeHtml(enquiry.submissionId)} · Sent automatically from the Team JD website</td></tr>
</table></td></tr></table></body></html>`;

  return {
    html,
    text: `New Team JD website enquiry\n\nName: ${fullName}\nEmail: ${enquiry.email}\nInterest: ${enquiry.serviceLabel}\nSubmitted: ${submittedAt}\nReference: ${enquiry.submissionId}\n\nEmail ${enquiry.firstName}: ${mailto}\n\nCustomer message:\n${enquiry.message}`
  };
}

function customerFrame({ baseUrl, preheaderText, firstName, lastName, email, serviceLabel, message, submissionId }) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const safeBaseUrl = escapeHtml(normalizedBaseUrl);
  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  return `<!doctype html>
<html lang="en">${documentHead({ title: 'We received your Team JD enquiry' })}
<body style="margin:0;padding:0;background:${BRAND.surface};color:${BRAND.ink};font-family:${FONT_STACK};-webkit-text-size-adjust:100%;">
${preheader(preheaderText)}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${BRAND.surface}" style="width:100%;border-collapse:collapse;background:${BRAND.surface};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="${SHELL_WIDTH}" cellspacing="0" cellpadding="0" bgcolor="#ffffff" class="email-shell" style="width:${SHELL_WIDTH}px;max-width:${SHELL_WIDTH}px;border-collapse:collapse;background:#ffffff;border-radius:14px;overflow:hidden;">
${emailHeader({ safeBaseUrl })}
${heroPanel({
  eyebrow: 'Enquiry Received',
  title: `Thanks, ${escapeHtml(firstName)}.<br>We&rsquo;ve got your enquiry.`,
  subtitleHtml: "It's on its way to Team JD for review — no further action needed from you."
})}
<tr><td bgcolor="#ffffff" class="mobile-pad" style="padding:30px 36px 0;background:#ffffff;">
<h2 style="margin:0 0 12px;color:${BRAND.ink};font-family:${FONT_STACK};font-size:17px;line-height:1.35;font-weight:800;">Your enquiry</h2>
${detailsCard([
  detailRow('Name', fullName),
  detailRow('Email', email),
  detailRow('Interest', serviceLabel)
])}
</td></tr>
<tr><td bgcolor="#ffffff" class="mobile-pad" style="padding:18px 36px 0;background:#ffffff;">
${messageQuote(message)}
</td></tr>
<tr><td bgcolor="#ffffff" class="mobile-pad" style="padding:26px 36px 4px;background:#ffffff;">
<h2 style="margin:0 0 8px;color:${BRAND.ink};font-family:${FONT_STACK};font-size:17px;line-height:1.35;font-weight:800;">What happens next</h2>
<p style="margin:0;color:${BRAND.body};font-family:${FONT_STACK};font-size:14.5px;line-height:1.7;">Team JD will personally review what you've sent and reply from this address. Need to add something in the meantime? Just reply to this email — it goes straight through.</p>
</td></tr>
<tr><td bgcolor="#ffffff" class="mobile-pad" style="padding:20px 36px 32px;background:#ffffff;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${BRAND.ctaTint}" style="width:100%;border-collapse:collapse;background:${BRAND.ctaTint};border-radius:10px;"><tr><td style="padding:14px 18px;border-radius:10px;color:${BRAND.ink};font-family:${FONT_STACK};font-size:13.5px;line-height:1.6;"><strong style="color:${BRAND.ctaDark};">Confirmed —</strong> this email is your receipt that the enquiry sent successfully.</td></tr></table>
</td></tr>
<tr><td bgcolor="${BRAND.surface}" class="mobile-pad" style="padding:22px 36px;background:${BRAND.surface};color:${BRAND.muted};font-family:${FONT_STACK};font-size:12px;line-height:1.7;border-top:1px solid ${BRAND.border};">
<strong style="color:${BRAND.ink};">Team JD · Adelaide, Australia</strong><br>
<a href="${safeBaseUrl}" style="color:${BRAND.accentDark};text-decoration:none;font-weight:700;">${safeBaseUrl}</a><br>
<span style="word-break:break-all;">Reference: ${escapeHtml(submissionId)}</span>
<div style="margin-top:10px;">If you did not submit this enquiry, you can ignore this message.</div>
</td></tr>
</table></td></tr></table></body></html>`;
}

function buildCustomerTemplate(enquiry, options) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fullName = [enquiry.firstName, enquiry.lastName].filter(Boolean).join(' ');

  return {
    html: customerFrame({
      baseUrl,
      preheaderText: 'Your enquiry has been sent to Team JD for review.',
      firstName: enquiry.firstName,
      lastName: enquiry.lastName,
      email: enquiry.email,
      serviceLabel: enquiry.serviceLabel,
      message: enquiry.message,
      submissionId: enquiry.submissionId
    }),
    text: `Thanks, ${enquiry.firstName}. We’ve got your enquiry.\n\nIt's on its way to Team JD for review — no further action needed from you.\n\nYour enquiry\nName: ${fullName}\nEmail: ${enquiry.email}\nInterest: ${enquiry.serviceLabel}\n\nYour message:\n${enquiry.message}\n\nWhat happens next\nTeam JD will personally review what you've sent and reply from this address. Need to add something in the meantime? Just reply to this email — it goes straight through.\n\nConfirmed — this email is your receipt that the enquiry sent successfully.\n\nTeam JD · Adelaide, Australia\n${baseUrl}\nReference: ${enquiry.submissionId}\n\nIf you did not submit this enquiry, you can ignore this message.`
  };
}

module.exports = {
  BRAND,
  buildCustomerTemplate,
  buildInternalTemplate,
  customerMailto,
  escapeHtml,
  formatAdelaideTimestamp
};
