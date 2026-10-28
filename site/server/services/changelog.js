const fs = require('fs/promises');
const path = require('path');

// The dashboard's "What's new" feed. Entries are written by hand in
// server/content/changelog.json, in plain language, one per meaningful change:
//   { "date": "YYYY-MM-DD", "text": "Added a booking button to the Services page." }
// Add new entries at the top. It lives outside public/ so it is only served to
// the signed-in dashboard, and stays readable while the maintenance gate is on.

const CHANGELOG_PATH = path.join(__dirname, '..', 'content', 'changelog.json');
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

// Returns one reason per bad entry, so a typo is easy to find and fix.
function validateEntries(raw) {
  if (!Array.isArray(raw)) return { entries: [], problems: ['The changelog must be a list of entries.'] };
  const entries = [];
  const problems = [];
  for (const [index, item] of raw.entries()) {
    const label = `Entry ${index + 1}`;
    if (!item || typeof item !== 'object') problems.push(`${label} is not an object.`);
    else if (!isRealDate(item.date)) problems.push(`${label} needs a date like "2026-10-27".`);
    else if (typeof item.text !== 'string' || !item.text.trim()) problems.push(`${label} needs some text.`);
    else entries.push({ date: item.date, text: item.text.trim() });
  }
  return { entries, problems };
}

// Newest first. Entries on the same day keep the order they were written in.
function sortNewestFirst(entries) {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

async function readChangelog(filePath = CHANGELOG_PATH) {
  let raw;
  try {
    raw = JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const { entries, problems } = validateEntries(raw);
  if (problems.length) console.warn(`[changelog] Skipped entries: ${problems.join(' ')}`);
  return sortNewestFirst(entries);
}

module.exports = { CHANGELOG_PATH, readChangelog, sortNewestFirst, validateEntries };
