const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { classifySource, cleanPath, createAnalytics, isBot } = require('./analytics');

const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';

async function tempAnalytics(now) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'analytics-'));
  return { dataDir, analytics: createAnalytics({ dataDir, now, timeZone: 'Australia/Adelaide' }) };
}

test('paths are reduced to public routes without query strings', () => {
  assert.equal(cleanPath('/Services/Posing-Only/?utm_source=ig#top'), '/services/posing-only');
  assert.equal(cleanPath('/'), '/');
  assert.equal(cleanPath('/admin/results'), null);
  assert.equal(cleanPath('/<script>'), null);
  assert.equal(cleanPath(42), null);
});

test('traffic sources come from the referrer or utm_source', () => {
  assert.equal(classifySource({ referrer: 'https://l.instagram.com/?u=x', siteHost: 'team-jd.com.au' }), 'Instagram');
  assert.equal(classifySource({ referrer: 'https://www.google.com.au/', siteHost: 'team-jd.com.au' }), 'Google');
  assert.equal(classifySource({ referrer: 'https://m.facebook.com/', siteHost: 'team-jd.com.au' }), 'Facebook');
  assert.equal(classifySource({ utmSource: 'ig', siteHost: 'team-jd.com.au' }), 'Instagram');
  assert.equal(classifySource({ referrer: '', siteHost: 'team-jd.com.au' }), 'Direct');
  assert.equal(classifySource({ referrer: 'https://team-jd.com.au/about', siteHost: 'team-jd.com.au' }), 'Direct');
  assert.equal(classifySource({ referrer: 'https://news.example.com/', siteHost: 'team-jd.com.au' }), 'Other');
});

test('bots and empty user agents are ignored', () => {
  assert.equal(isBot('Googlebot/2.1'), true);
  assert.equal(isBot('facebookexternalhit/1.1'), true);
  assert.equal(isBot(''), true);
  assert.equal(isBot(PHONE), false);
});

test('only the minimum is stored: no IP, user agent or query string', async () => {
  const at = new Date('2026-10-10T02:00:00Z');
  const { analytics, dataDir } = await tempAnalytics(() => at);
  assert.equal(await analytics.record({ path: '/results?q=1', referrer: 'https://instagram.com/', visitStart: true, userAgent: PHONE, siteHost: 'team-jd.com.au' }), true);
  assert.equal(await analytics.record({ path: '/', visitStart: true, userAgent: 'Googlebot' }), false);

  const lines = (await fs.readFile(path.join(dataDir, '2026-10.jsonl'), 'utf8')).trim().split('\n');
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), {
    ts: '2026-10-10T02:00:00.000Z', path: '/results', source: 'Instagram', visitStart: true, device: 'phone'
  });
});

test('stats compare this period with the previous one, by Adelaide day', async () => {
  let clock = new Date('2026-09-20T01:00:00Z');
  const { analytics } = await tempAnalytics(() => clock);
  const view = (pagePath, visitStart, referrer = '') => analytics.record({
    path: pagePath, visitStart, referrer, userAgent: DESKTOP, siteHost: 'team-jd.com.au'
  });

  // Previous 7-day period: one visit.
  await view('/', true);
  // Current period, crossing a month boundary.
  clock = new Date('2026-09-30T23:30:00Z'); // 1 October in Adelaide
  await view('/', true, 'https://www.instagram.com/');
  await view('/results', false);
  clock = new Date('2026-10-02T03:00:00Z');
  await view('/results', true, 'https://www.google.com/');
  await view('/contact', false);

  clock = new Date('2026-10-03T03:00:00Z');
  const stats = await analytics.getStats('7d');
  assert.deepEqual(stats.current, { visits: 2, pageViews: 4 });
  assert.deepEqual(stats.previous, { visits: 1, pageViews: 1 });
  assert.equal(stats.daily.length, 7);
  assert.equal(stats.daily.at(-1).date, '2026-10-03');
  assert.deepEqual(stats.daily.find((day) => day.date === '2026-10-01'), { date: '2026-10-01', visits: 1, pageViews: 2, previousVisits: 0 });
  assert.deepEqual(stats.topPages[0], { path: '/results', count: 2 });
  assert.deepEqual(stats.sources.map((item) => item.source).sort(), ['Google', 'Instagram']);

  const month = await analytics.getStats('30d');
  assert.deepEqual(month.current, { visits: 3, pageViews: 5 });
});

test('an unknown range falls back to 30 days and an empty log gives zeros', async () => {
  const { analytics } = await tempAnalytics(() => new Date('2026-10-03T03:00:00Z'));
  const stats = await analytics.getStats('forever');
  assert.equal(stats.range, '30d');
  assert.equal(stats.daily.length, 30);
  assert.deepEqual(stats.current, { visits: 0, pageViews: 0 });
  assert.deepEqual(stats.topPages, []);
});
