const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_ACTION = 'general-enquiry';

function getTurnstileConfig() {
  return {
    siteKey: (process.env.TURNSTILE_SITE_KEY || '').trim(),
    secretKey: (process.env.TURNSTILE_SECRET_KEY || '').trim()
  };
}

async function verifyTurnstile({ token, remoteIp, fetchImpl = global.fetch }) {
  const { secretKey } = getTurnstileConfig();

  if (!secretKey || typeof fetchImpl !== 'function') {
    return { ok: false, unavailable: true };
  }

  const form = new URLSearchParams({
    secret: secretKey,
    response: token
  });
  if (remoteIp && remoteIp !== 'unknown') form.set('remoteip', remoteIp);

  try {
    const response = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) return { ok: false, unavailable: true };

    const result = await response.json();
    let expectedHostname = null;
    try {
      expectedHostname = new URL(process.env.PUBLIC_BASE_URL || 'https://team-jd.com.au').hostname;
    } catch (_error) {
      return { ok: false, unavailable: true };
    }

    const actionMatches = result.action === TURNSTILE_ACTION;
    const hostnameMatches = result.hostname === expectedHostname;
    return {
      ok: result.success === true && actionMatches && hostnameMatches,
      unavailable: false
    };
  } catch (_error) {
    return { ok: false, unavailable: true };
  }
}

module.exports = { getTurnstileConfig, TURNSTILE_ACTION, verifyTurnstile };
