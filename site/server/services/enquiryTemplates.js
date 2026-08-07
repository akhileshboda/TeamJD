const BRAND = Object.freeze({
  accent: '#16c9dd',
  accentDark: '#087f8c',
  background: '#101314',
  cta: '#FA8072',
  ink: '#15191a',
  muted: '#626b6e',
  surface: '#eef2f3'
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

function documentHead({ title, mobileHeadingSize = '29px' }) {
  return `<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
<style>
@media only screen and (max-width:620px) {
  .email-shell { width:100% !important; }
  .mobile-pad { padding-left:22px !important; padding-right:22px !important; }
  .hero-title { font-size:${mobileHeadingSize} !important; line-height:1.16 !important; }
  .mobile-button { display:block !important; text-align:center !important; }
}
</style>
</head>`;
}

function preheader(value) {
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(value)}</div>`;
}

function brandStrip() {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;"><tr><td width="78%" height="6" bgcolor="${BRAND.accent}" style="height:6px;font-size:0;line-height:0;">&nbsp;</td><td width="22%" height="6" bgcolor="${BRAND.cta}" style="height:6px;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}

function customerFrame({ baseUrl, preheaderText, firstName, serviceLabel, submissionId }) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const safeBaseUrl = escapeHtml(normalizedBaseUrl);
  const logoUrl = `${safeBaseUrl}/assets/branding/team-jd-logo.png`;

  return `<!doctype html>
<html lang="en">${documentHead({ title: 'We received your Team JD enquiry' })}
<body style="margin:0;padding:0;background:${BRAND.surface};color:${BRAND.ink};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
${preheader(preheaderText)}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${BRAND.surface}" style="width:100%;border-collapse:collapse;background:${BRAND.surface};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" bgcolor="#ffffff" class="email-shell" style="width:600px;max-width:600px;border-collapse:collapse;background:#ffffff;">
<tr><td>${brandStrip()}</td></tr>
<tr><td bgcolor="#ffffff" class="mobile-pad" style="padding:18px 32px;background:#ffffff;"><a href="${safeBaseUrl}" style="text-decoration:none;"><img src="${logoUrl}" width="138" alt="Team JD — Jake Dedert" style="display:block;width:138px;max-width:100%;height:auto;border:0;"></a></td></tr>
<tr><td bgcolor="${BRAND.background}" class="mobile-pad" style="padding:30px 32px 32px;background:${BRAND.background};">
<div style="margin:0 0 10px;color:${BRAND.accent};font-size:12px;line-height:1.4;font-weight:bold;letter-spacing:1.6px;">ENQUIRY RECEIVED</div>
<h1 class="hero-title" style="margin:0 0 12px;color:#ffffff;font-size:34px;line-height:1.14;font-weight:800;">Thanks, ${escapeHtml(firstName)}.<br>We&rsquo;ve got your enquiry.</h1>
<p style="margin:0;color:#dfe5e6;font-size:16px;line-height:1.65;">Your enquiry has been sent to Team JD for review.</p>
</td></tr>
<tr><td bgcolor="#ffffff" class="mobile-pad" style="padding:30px 32px 32px;background:#ffffff;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#eaf9fb" style="width:100%;border-collapse:collapse;background:#eaf9fb;border-left:4px solid ${BRAND.accent};"><tr><td style="padding:16px 18px;">
<div style="margin:0 0 5px;color:${BRAND.accentDark};font-size:11px;line-height:1.4;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;">You asked about</div>
<div style="color:${BRAND.ink};font-size:17px;line-height:1.45;font-weight:bold;">${escapeHtml(serviceLabel)}</div>
</td></tr></table>
<h2 style="margin:28px 0 10px;color:${BRAND.ink};font-size:21px;line-height:1.3;">What happens next</h2>
<p style="margin:0;color:#33393b;font-size:16px;line-height:1.7;">Team JD will review the details you sent. If you need to add anything, simply reply to this email.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#fff2ef" style="width:100%;margin-top:24px;border-collapse:collapse;background:#fff2ef;"><tr><td width="5" bgcolor="${BRAND.cta}" style="width:5px;background:${BRAND.cta};font-size:0;line-height:0;">&nbsp;</td><td style="padding:14px 16px;color:#3b3331;font-size:14px;line-height:1.6;">No action is needed right now. This email confirms that your enquiry was sent successfully.</td></tr></table>
</td></tr>
<tr><td bgcolor="#f3f5f5" class="mobile-pad" style="padding:22px 32px;background:#f3f5f5;color:${BRAND.muted};font-size:12px;line-height:1.65;">
<strong style="color:#303638;">Team JD · Adelaide, Australia</strong><br>
<a href="${safeBaseUrl}" style="color:${BRAND.accentDark};text-decoration:underline;">${safeBaseUrl}</a><br>
<span style="word-break:break-all;">Reference: ${escapeHtml(submissionId)}</span>
<div style="margin-top:12px;padding-top:12px;border-top:1px solid #d8dede;">If you did not submit this enquiry, you can ignore this message.</div>
</td></tr>
</table></td></tr></table></body></html>`;
}

function internalDetailsRow(label, value, options = {}) {
  const renderedValue = options.href
    ? `<a href="${escapeHtml(options.href)}" style="color:${BRAND.accentDark};text-decoration:underline;word-break:break-word;">${escapeHtml(value)}</a>`
    : escapeHtml(value);

  return `<tr><td style="padding:7px 0;color:${BRAND.muted};font-size:13px;line-height:1.5;vertical-align:top;width:108px;">${escapeHtml(label)}</td><td style="padding:7px 0;color:${BRAND.ink};font-size:14px;line-height:1.5;vertical-align:top;">${renderedValue}</td></tr>`;
}

function buildInternalTemplate(enquiry, options) {
  const fullName = [enquiry.firstName, enquiry.lastName].filter(Boolean).join(' ');
  const submittedAt = formatAdelaideTimestamp(options.timestamp);
  const mailto = customerMailto(enquiry.email);

  const html = `<!doctype html>
<html lang="en">${documentHead({ title: 'New Team JD website enquiry', mobileHeadingSize: '27px' })}
<body style="margin:0;padding:0;background:#f4f6f6;color:${BRAND.ink};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
${preheader(`New enquiry from ${fullName}`)}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f4f6f6" style="width:100%;border-collapse:collapse;background:#f4f6f6;"><tr><td align="center" style="padding:20px 12px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" bgcolor="#ffffff" class="email-shell" style="width:600px;max-width:600px;border-collapse:collapse;background:#ffffff;">
<tr><td>${brandStrip()}</td></tr>
<tr><td bgcolor="#ffffff" class="mobile-pad" style="padding:24px 30px 10px;background:#ffffff;color:${BRAND.muted};font-size:12px;line-height:1.4;font-weight:bold;letter-spacing:1.4px;">TEAM JD · NEW ENQUIRY</td></tr>
<tr><td bgcolor="#ffffff" class="mobile-pad" style="padding:8px 30px 30px;background:#ffffff;">
<h1 class="hero-title" style="margin:0 0 10px;color:${BRAND.ink};font-size:30px;line-height:1.2;">New website enquiry</h1>
<p style="margin:0 0 20px;color:#3c4244;font-size:15px;line-height:1.65;">A customer submitted the Team JD general enquiry form.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border-top:1px solid #dce1e2;border-bottom:1px solid #dce1e2;">
${internalDetailsRow('Name', fullName)}
${internalDetailsRow('Email', enquiry.email, { href: mailto })}
${internalDetailsRow('Interest', enquiry.serviceLabel)}
${internalDetailsRow('Submitted', submittedAt)}
</table>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:20px 0 28px;"><tr><td bgcolor="${BRAND.cta}" style="background:${BRAND.cta};"><a href="${escapeHtml(mailto)}" class="mobile-button" style="display:inline-block;padding:12px 20px;color:#171313;text-decoration:none;font-size:14px;line-height:1.3;font-weight:bold;">Email ${escapeHtml(enquiry.firstName)}</a></td></tr></table>
<h2 style="margin:0 0 9px;color:${BRAND.ink};font-size:17px;line-height:1.4;">Customer message</h2>
<div style="margin:0;padding:16px;background:#f5f7f7;color:#252a2c;font-size:15px;line-height:1.7;white-space:pre-wrap;word-break:break-word;">${escapeHtml(enquiry.message)}</div>
</td></tr>
<tr><td bgcolor="#f1f4f4" class="mobile-pad" style="padding:18px 30px;background:#f1f4f4;color:${BRAND.muted};font-size:12px;line-height:1.6;word-break:break-all;">Reference: ${escapeHtml(enquiry.submissionId)}</td></tr>
</table></td></tr></table></body></html>`;

  return {
    html,
    text: `New Team JD website enquiry\n\nName: ${fullName}\nEmail: ${enquiry.email}\nInterest: ${enquiry.serviceLabel}\nSubmitted: ${submittedAt}\nReference: ${enquiry.submissionId}\n\nEmail ${enquiry.firstName}: ${mailto}\n\nCustomer message:\n${enquiry.message}`
  };
}

function buildCustomerTemplate(enquiry, options) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);

  return {
    html: customerFrame({
      baseUrl,
      preheaderText: 'Your enquiry has been sent to Team JD for review.',
      firstName: enquiry.firstName,
      serviceLabel: enquiry.serviceLabel,
      submissionId: enquiry.submissionId
    }),
    text: `Thanks, ${enquiry.firstName}. We’ve got your enquiry.\n\nYour enquiry has been sent to Team JD for review.\n\nYou asked about: ${enquiry.serviceLabel}\n\nWhat happens next\nTeam JD will review the details you sent. If you need to add anything, simply reply to this email.\n\nNo action is needed right now. This email confirms that your enquiry was sent successfully.\n\nTeam JD · Adelaide, Australia\n${baseUrl}\nReference: ${enquiry.submissionId}\n\nIf you did not submit this enquiry, you can ignore this message.`
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
