const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const readline = require('readline');

// First-party, cookie-less visit counting for the dashboard's Home screen.
//
// The browser sends one beacon per page view (client/src/components/PageViewTracker.jsx).
// We keep only: when, which page, a coarse traffic source, whether it started a
// visit, and phone/tablet/desktop. No IP address, cookie, full user agent or query
// string is stored. One JSON line per view, one file per UTC month.

const DATA_DIR = process.env.ANALYTICS_DATA_DIR || path.join(__dirname, '..', '..', 'data', 'analytics');
const TIME_ZONE = process.env.ANALYTICS_TIME_ZONE || 'Australia/Adelaide';
const RANGES = { '7d': 7, '30d': 30, '90d': 90 };
const CACHE_MS = 60 * 1000;

const BOT_PATTERN = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|httpclient|axios|node-fetch|go-http/i;

const SOURCE_RULES = [
  ['Instagram', /(^|\.)instagram\.com$|^ig$|instagram/],
  ['Facebook', /(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$|^fb$|facebook/],
  ['Google', /(^|\.)google\.[a-z.]+$|^google$/],
  ['TikTok', /(^|\.)tiktok\.com$|tiktok/],
  ['YouTube', /(^|\.)(youtube\.com|youtu\.be)$|youtube/]
];

function isBot(userAgent) {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

// Public pages only, as the router knows them: lowercase path segments, no query.
function cleanPath(value) {
  if (typeof value !== 'string') return null;
  const pathOnly = value.split(/[?#]/)[0].trim().toLowerCase().replace(/\/+$/, '') || '/';
  if (pathOnly.length > 80 || !/^\/[a-z0-9\-/]*$/.test(pathOnly)) return null;
  if (pathOnly === '/admin' || pathOnly.startsWith('/admin/')) return null;
  return pathOnly;
}

function hostOf(value) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '');
  } catch (_error) {
    return '';
  }
}

function classifySource({ referrer, utmSource, siteHost }) {
  const utm = String(utmSource || '').trim().toLowerCase().slice(0, 40);
  const host = hostOf(referrer);
  const candidate = utm || host;
  if (!candidate || (host && siteHost && host === siteHost && !utm)) return 'Direct';
  const match = SOURCE_RULES.find(([, pattern]) => pattern.test(candidate));
  return match ? match[0] : 'Other';
}

function deviceOf(userAgent) {
  if (/ipad|tablet/i.test(userAgent)) return 'tablet';
  if (/mobi|iphone|android/i.test(userAgent)) return 'phone';
  return 'desktop';
}

function increment(counts, key) {
  counts.set(key, (counts.get(key) || 0) + 1);
}

function sumDays(buckets, days) {
  return days.reduce((sum, day) => ({
    visits: sum.visits + buckets.get(day).visits,
    pageViews: sum.pageViews + buckets.get(day).pageViews
  }), { visits: 0, pageViews: 0 });
}

function topEntries(counts, label, limit = 6) {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ [label]: name, count }));
}

function monthFile(date, dataDir) {
  return path.join(dataDir, `${date.toISOString().slice(0, 7)}.jsonl`);
}

function createAnalytics({ dataDir = DATA_DIR, now = () => new Date(), timeZone = TIME_ZONE } = {}) {
  const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const localDay = (date) => dayFormat.format(date);
  const cache = new Map();
  let ensuredDir = false;

  async function record({ path: rawPath, referrer, utmSource, visitStart, userAgent, siteHost }) {
    if (isBot(userAgent)) return false;
    const pagePath = cleanPath(rawPath);
    if (!pagePath) return false;
    const at = now();
    const event = {
      ts: at.toISOString(),
      path: pagePath,
      source: visitStart ? classifySource({ referrer, utmSource, siteHost }) : null,
      visitStart: Boolean(visitStart),
      device: deviceOf(userAgent)
    };
    if (!ensuredDir) {
      await fsp.mkdir(dataDir, { recursive: true });
      ensuredDir = true;
    }
    await fsp.appendFile(monthFile(at, dataDir), `${JSON.stringify(event)}\n`);
    cache.clear();
    return true;
  }

  async function* eventsBetween(start, end) {
    const months = new Set();
    for (let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)); cursor <= end;) {
      months.add(monthFile(cursor, dataDir));
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    }
    for (const file of months) {
      if (!fs.existsSync(file)) continue;
      const lines = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
      for await (const line of lines) {
        if (!line) continue;
        let event;
        try {
          event = JSON.parse(line);
        } catch (_error) {
          continue;
        }
        const at = new Date(event.ts);
        if (at >= start && at <= end) yield { ...event, at };
      }
    }
  }

  // Calendar arithmetic on YYYY-MM-DD strings, so daylight-saving shifts never
  // skip or repeat a day.
  function shiftDay(day, delta) {
    const [year, month, date] = day.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, date + delta)).toISOString().slice(0, 10);
  }

  function dayList(lastDay, days) {
    return Array.from({ length: days }, (_, index) => shiftDay(lastDay, index - days + 1));
  }

  // Counts every event in the scan window into its local day, and the current
  // period's events into page and source tallies.
  async function tallyEvents(scanStart, end, buckets, currentDays) {
    const currentSet = new Set(currentDays);
    const pages = new Map();
    const sources = new Map();
    for await (const event of eventsBetween(scanStart, end)) {
      const day = localDay(event.at);
      const bucket = buckets.get(day);
      if (!bucket) continue;
      bucket.pageViews += 1;
      if (event.visitStart) bucket.visits += 1;
      if (!currentSet.has(day)) continue;
      increment(pages, event.path);
      if (event.visitStart) increment(sources, event.source || 'Direct');
    }
    return { pages, sources };
  }

  async function getStats(requestedRange = '30d') {
    const range = requestedRange in RANGES ? requestedRange : '30d';
    const end = now();
    const cacheKey = `${range}:${localDay(end)}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

    const days = RANGES[range];
    const currentDays = dayList(localDay(end), days);
    const previousDays = dayList(shiftDay(currentDays[0], -1), days);
    const buckets = new Map([...currentDays, ...previousDays].map((day) => [day, { visits: 0, pageViews: 0 }]));
    const scanStart = new Date(end.getTime() - (2 * days + 2) * 86400000);
    const { pages, sources } = await tallyEvents(scanStart, end, buckets, currentDays);

    const value = {
      range,
      timeZone,
      current: sumDays(buckets, currentDays),
      previous: sumDays(buckets, previousDays),
      daily: currentDays.map((day, index) => ({
        date: day,
        ...buckets.get(day),
        previousVisits: buckets.get(previousDays[index]).visits
      })),
      topPages: topEntries(pages, 'path'),
      sources: topEntries(sources, 'source')
    };
    cache.set(cacheKey, { at: Date.now(), value });
    return value;
  }

  return { record, getStats };
}

let defaultAnalytics = null;
function getAnalytics() {
  defaultAnalytics ??= createAnalytics();
  return defaultAnalytics;
}

module.exports = { RANGES, classifySource, cleanPath, createAnalytics, deviceOf, getAnalytics, isBot };
