#!/usr/bin/env node
// Writes ~120 days of fake page views into ANALYTICS_DATA_DIR so the dashboard's
// Home screen can be audited with data in it. Local use only: refuses to run
// unless the target directory sits under a folder named "ui-audit".
//
//   node tools/ui-audit/seed-analytics.js [--days 120] [--seed 7]

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const DAYS = arg('days', 120);
let state = arg('seed', 7);
const rand = () => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (weighted) => {
  const total = weighted.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [value, w] of weighted) if ((r -= w) <= 0) return value;
  return weighted[0][0];
};

const dir = process.env.ANALYTICS_DATA_DIR;
if (!dir || !/[\\/]ui-audit[\\/]/.test(dir)) {
  console.error('ANALYTICS_DATA_DIR must point inside a ui-audit scratch folder. Refusing to write.');
  process.exit(1);
}
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const PATHS = [['/', 40], ['/services', 18], ['/results', 14], ['/about', 10], ['/contact', 9],
  ['/services/online-coaching', 6], ['/services/comp-prep', 5], ['/services/in-person-training', 4], ['/privacy', 1]];
const SOURCES = [['Instagram', 45], ['Direct', 25], ['Google', 18], ['Facebook', 6], ['TikTok', 3], ['Other', 3]];
const DEVICES = [['phone', 70], ['desktop', 24], ['tablet', 6]];

const files = new Map();
const now = Date.now();
let views = 0;
for (let d = DAYS; d >= 0; d -= 1) {
  const growth = 1 + (DAYS - d) / DAYS; // gently rising traffic
  const weekend = new Date(now - d * 864e5).getUTCDay() % 6 === 0 ? 1.3 : 1;
  const visits = Math.round((8 + rand() * 14) * growth * weekend);
  for (let v = 0; v < visits; v += 1) {
    const device = pick(DEVICES);
    const pages = 1 + Math.floor(rand() * 3.2);
    let t = now - d * 864e5 - Math.floor(rand() * 864e5);
    for (let p = 0; p < pages; p += 1) {
      const at = new Date(t);
      const event = {
        ts: at.toISOString(),
        path: pick(PATHS),
        source: p === 0 ? pick(SOURCES) : null,
        visitStart: p === 0,
        device
      };
      const file = path.join(dir, `${event.ts.slice(0, 7)}.jsonl`);
      if (!files.has(file)) files.set(file, []);
      files.get(file).push(event);
      t += 20000 + Math.floor(rand() * 90000);
      views += 1;
    }
  }
}
for (const [file, events] of files) {
  events.sort((a, b) => a.ts.localeCompare(b.ts));
  fs.writeFileSync(file, events.map((e) => JSON.stringify(e)).join('\n') + '\n');
}
console.log(`Seeded ${views} page views over ${DAYS} days into ${dir}`);
