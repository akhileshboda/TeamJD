const assert = require('node:assert/strict');
const test = require('node:test');
const { checkSite, robotsBlocksGooglebot } = require('./seoCheck');

const ORIGIN = 'https://site.example.com';

function page({ path, robots = 'index, follow', canonical = `${ORIGIN}${path}`, title = 'Page' }) {
  return `<html><head><title>${title}</title><meta name="robots" content="${robots}">`
    + `<link rel="canonical" href="${canonical}"></head></html>`;
}

// A healthy site; `overrides` maps a URL to a replacement { status, body, headers }.
function fakeSite(overrides = {}) {
  const routes = {
    [`${ORIGIN}/robots.txt`]: { body: `User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${ORIGIN}/sitemap.xml\n` },
    [`${ORIGIN}/sitemap.xml`]: { body: `<urlset><url><loc>${ORIGIN}/</loc></url><url><loc>${ORIGIN}/about</loc></url></urlset>` },
    [`${ORIGIN}/`]: { body: page({ path: '/' }) },
    [`${ORIGIN}/about`]: { body: page({ path: '/about' }) },
    [`${ORIGIN}/about/`]: { status: 301, headers: { location: `${ORIGIN}/about` } },
    [`${ORIGIN}/index.html`]: { status: 301, headers: { location: `${ORIGIN}/` } },
    'https://www.site.example.com/': { status: 301, headers: { location: `${ORIGIN}/` } },
    [`${ORIGIN}/admin`]: { body: page({ path: '/admin', robots: 'noindex, nofollow' }) },
    ...overrides
  };
  return async (url) => {
    const route = routes[url] || { status: 404, body: page({ path: '/x', robots: 'noindex' }) };
    if (route.throws) throw route.throws;
    return new Response(route.body ?? '', { status: route.status ?? 200, headers: route.headers });
  };
}

test('a healthy site passes', async () => {
  const result = await checkSite(ORIGIN, { fetchImpl: fakeSite() });
  assert.deepEqual(result.failures, []);
  assert.equal(result.pagesChecked, 2);
});

test('noindex, wrong canonical and server errors on sitemap pages fail', async () => {
  const result = await checkSite(ORIGIN, {
    fetchImpl: fakeSite({
      [`${ORIGIN}/`]: { body: page({ path: '/', robots: 'noindex' }) },
      [`${ORIGIN}/about`]: { body: page({ path: '/about', canonical: `${ORIGIN}/` }) }
    })
  });
  assert.equal(result.failures.length, 2);
  assert.match(result.failures[0], /noindex meta/);
  assert.match(result.failures[1], /canonical is/);

  const down = await checkSite(ORIGIN, { fetchImpl: fakeSite({ [`${ORIGIN}/about`]: { status: 503 } }) });
  assert.match(down.failures.join('\n'), /about returned 503/);
});

test('an X-Robots-Tag noindex header fails even with a clean meta tag', async () => {
  const result = await checkSite(ORIGIN, {
    fetchImpl: fakeSite({ [`${ORIGIN}/about`]: { body: page({ path: '/about' }), headers: { 'x-robots-tag': 'noindex' } } })
  });
  assert.match(result.failures.join('\n'), /X-Robots-Tag/);
});

test('missing redirects, soft 404s and an indexable dashboard fail', async () => {
  const result = await checkSite(ORIGIN, {
    fetchImpl: fakeSite({
      [`${ORIGIN}/about/`]: { body: page({ path: '/about' }) },
      'https://www.site.example.com/': { body: page({ path: '/' }) },
      [`${ORIGIN}/seo-check-missing-page`]: { body: page({ path: '/' }) },
      [`${ORIGIN}/admin`]: { body: page({ path: '/admin' }) }
    })
  });
  const text = result.failures.join('\n');
  assert.match(text, /about\/ should 301/);
  assert.match(text, /www\.site\.example\.com\/ should 301/);
  assert.match(text, /unknown page returned 200/);
  assert.match(text, /admin is not marked noindex/);
});

test('an unreachable www host is noted, not failed', async () => {
  const error = Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } });
  const result = await checkSite(ORIGIN, {
    fetchImpl: fakeSite({ 'https://www.site.example.com/': { throws: error } })
  });
  assert.deepEqual(result.failures, []);
  assert.match(result.notes[0], /ENOTFOUND/);
});

test('robots.txt only fails when Googlebot itself is blocked', () => {
  assert.equal(robotsBlocksGooglebot('User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n'), false);
  assert.equal(robotsBlocksGooglebot('User-agent: *\nDisallow: /\n'), true);
  assert.equal(robotsBlocksGooglebot('User-agent: *\nUser-agent: Bingbot\nDisallow: /\n'), true);
  assert.equal(robotsBlocksGooglebot('User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /\n'), false);
  assert.equal(robotsBlocksGooglebot('User-agent: *\nDisallow: /admin\n'), false);
});
