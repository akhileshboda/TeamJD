const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { CHANGELOG_PATH, readChangelog, validateEntries } = require('./changelog');

async function writeTemp(contents) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'changelog-'));
  const filePath = path.join(dir, 'changelog.json');
  await fs.writeFile(filePath, typeof contents === 'string' ? contents : JSON.stringify(contents));
  return filePath;
}

test('the shipped changelog is valid, so a typo is caught before it reaches the dashboard', async () => {
  const raw = JSON.parse(await fs.readFile(CHANGELOG_PATH, 'utf8'));
  const { entries, problems } = validateEntries(raw);
  assert.deepEqual(problems, []);
  assert.equal(entries.length, raw.length);
});

test('entries come back newest first, with same-day entries kept in written order', async () => {
  const filePath = await writeTemp([
    { date: '2026-10-01', text: 'Oldest' },
    { date: '2026-10-20', text: 'Newest, written first' },
    { date: '2026-10-20', text: 'Newest, written second' }
  ]);
  const entries = await readChangelog(filePath);
  assert.deepEqual(entries.map((entry) => entry.text), ['Newest, written first', 'Newest, written second', 'Oldest']);
});

test('text is trimmed and unknown fields are dropped', async () => {
  const filePath = await writeTemp([{ date: '2026-10-20', text: '  Added a button  ', author: 'x' }]);
  assert.deepEqual(await readChangelog(filePath), [{ date: '2026-10-20', text: 'Added a button' }]);
});

test('bad entries are skipped and explained rather than breaking the feed', () => {
  const { entries, problems } = validateEntries([
    { date: '2026-10-20', text: 'Fine' },
    { date: '2026-02-31', text: 'Not a real day' },
    { date: '20 Oct 2026', text: 'Wrong format' },
    { date: '2026-10-20', text: '   ' },
    null
  ]);
  assert.deepEqual(entries, [{ date: '2026-10-20', text: 'Fine' }]);
  assert.equal(problems.length, 4);
  assert.match(problems[0], /Entry 2/);
});

test('a missing file is an empty feed, but broken JSON is an error', async () => {
  assert.deepEqual(await readChangelog(path.join(os.tmpdir(), 'does-not-exist-changelog.json')), []);
  await assert.rejects(readChangelog(await writeTemp('[{ "date": ')));
});
