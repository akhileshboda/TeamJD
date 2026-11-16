// Post-deploy SEO smoke check against the live public site. It catches the
// failures Search Console only reports days later: pages that 5xx, carry
// noindex, point their canonical elsewhere, or get blocked in robots.txt.
//
//   npm run seo:check -- https://team-jd.com.au
//
// Production only: staging is noindex on purpose and would fail every page.

function parseRobotsGroups(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const match = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const field = match[1].toLowerCase();
    const value = match[2].trim();
    if (field === 'user-agent') {
      if (!lastWasAgent) {
        current = { agents: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current && field === 'disallow') current.disallow.push(value);
    }
  }
  return groups;
}

// True when the rules Googlebot follows block the whole site.
function robotsBlocksGooglebot(text) {
  const groups = parseRobotsGroups(text);
  const own = groups.filter((group) => group.agents.includes('googlebot'));
  const applicable = own.length ? own : groups.filter((group) => group.agents.includes('*'));
  return applicable.some((group) => group.disallow.includes('/'));
}

function isNoindex(value) {
  return /\bnoindex\b/i.test(String(value || ''));
}

function pageSignals(html) {
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i)?.[1] || null;
  const robots = html.match(/<meta\s+name="robots"\s+content="([^"]*)"/i)?.[1] || '';
  const title = (html.match(/<title>([^<]*)<\/title>/i)?.[1] || '').trim();
  return { canonical, robots, title };
}

function twinHost(hostname) {
  return hostname.startsWith('www.') ? hostname.slice(4) : `www.${hostname}`;
}

async function checkSite(baseUrl, { fetchImpl = fetch } = {}) {
  const base = new URL(baseUrl);
  const origin = base.origin;
  const failures = [];
  const notes = [];
  const fail = (message) => failures.push(message);
  const get = (url) => fetchImpl(url, { redirect: 'manual', headers: { 'User-Agent': 'TeamJD-SEO-check' } });

  async function expectRedirect(from, to) {
    try {
      const response = await get(from);
      const location = response.headers.get('location');
      if (response.status !== 301 || location !== to) {
        fail(`${from} should 301 to ${to}, got ${response.status}${location ? ` -> ${location}` : ''}`);
      }
    } catch (error) {
      return error;
    }
    return null;
  }

  const robots = await get(`${origin}/robots.txt`);
  const robotsText = robots.status === 200 ? await robots.text() : '';
  if (robots.status !== 200) fail(`robots.txt returned ${robots.status}`);
  else {
    if (robotsBlocksGooglebot(robotsText)) fail('robots.txt blocks Googlebot from the whole site');
    if (!robotsText.includes(`Sitemap: ${origin}/sitemap.xml`)) fail('robots.txt does not list the sitemap');
  }

  const sitemap = await get(`${origin}/sitemap.xml`);
  const locs = sitemap.status === 200
    ? [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim())
    : [];
  if (sitemap.status !== 200) fail(`sitemap.xml returned ${sitemap.status}`);
  else if (!locs.length) fail('sitemap.xml lists no URLs');

  for (const loc of locs) {
    if (new URL(loc).origin !== origin) {
      fail(`${loc} in the sitemap is not on ${origin}`);
      continue;
    }
    const response = await get(loc);
    if (response.status !== 200) {
      fail(`${loc} returned ${response.status}`);
      continue;
    }
    const { canonical, robots: metaRobots, title } = pageSignals(await response.text());
    if (isNoindex(response.headers.get('x-robots-tag'))) fail(`${loc} sends X-Robots-Tag noindex`);
    if (isNoindex(metaRobots)) fail(`${loc} has a noindex meta tag`);
    if (canonical !== loc) fail(`${loc} canonical is ${canonical || 'missing'}`);
    if (!title) fail(`${loc} has no <title>`);
  }

  const inner = locs.find((loc) => new URL(loc).pathname !== '/');
  if (inner) await expectRedirect(`${inner}/`, inner);
  await expectRedirect(`${origin}/index.html`, `${origin}/`);

  const twin = `${base.protocol}//${twinHost(base.hostname)}`;
  const twinError = await expectRedirect(`${twin}/`, `${origin}/`);
  if (twinError) notes.push(`skipped ${twin} (not reachable: ${twinError.cause?.code || twinError.message})`);

  const missing = await get(`${origin}/seo-check-missing-page`);
  if (missing.status !== 404) fail(`an unknown page returned ${missing.status}, not 404`);

  const admin = await get(`${origin}/admin`);
  const adminNoindex = isNoindex(admin.headers.get('x-robots-tag'))
    || isNoindex(pageSignals(await admin.text()).robots);
  if (!adminNoindex) fail('/admin is not marked noindex');

  return { failures, notes, pagesChecked: locs.length };
}

async function main() {
  const baseUrl = process.argv[2] || process.env.SEO_CHECK_URL || process.env.PUBLIC_BASE_URL;
  if (!baseUrl || !/^https:\/\//.test(baseUrl)) {
    console.error('Usage: npm run seo:check -- https://your-site.example');
    process.exit(2);
  }
  const { failures, notes, pagesChecked } = await checkSite(baseUrl);
  for (const note of notes) console.log(`note: ${note}`);
  if (failures.length) {
    console.error(`SEO check FAILED for ${baseUrl} (${failures.length} problem${failures.length === 1 ? '' : 's'}):`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`SEO check passed for ${baseUrl}: ${pagesChecked} sitemap pages indexable, redirects and robots.txt OK.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`SEO check could not run: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { checkSite, robotsBlocksGooglebot };
