const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { applyEnvFlag, runCapacityTest } = require('./capacityReport');

const ENV = {
  ENQUIRY_MAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 'resend-key',
  ENQUIRY_EMAIL_FROM: 'Team JD <enquiries@send.team-jd.com.au>',
  CAPACITY_ALERT_TO: 'ops@example.com',
  PORT: '3111'
};
const NOW = Date.UTC(2026, 9, 26, 12);
const hostSampler = async () => ({ cpu: 0.12, ram: 0.34 });
const healthy = async () => ({ ok: true, status: 200, json: async () => ({ status: 'ok', uptimeSeconds: 3600 }) });

async function stateFile(contents) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'capacity-report-'));
  const file = path.join(dir, 'state.json');
  if (contents) await fs.writeFile(file, JSON.stringify(contents));
  return file;
}

function recorder() {
  const batches = [];
  return { batches, provider: { async sendBatch(messages, key) { batches.push({ messages, key }); return { accepted: true }; } } };
}

const snapshot = { writtenAt: NOW - 20000, intervalMs: 30000, eventLoopMs: 9, rssBytes: 90 * 1048576, requestsPerMin: 55, lastAlertAt: 123, breaching: false };

test('a healthy site sends one [TEST] report with every check passing', async () => {
  const { batches, provider } = recorder();
  const result = await runCapacityTest({
    env: { ...ENV, NODE_ENV: 'production' }, fetchImpl: healthy, provider, hostSampler, now: () => NOW,
    stateFile: await stateFile({ latest: snapshot })
  });

  assert.equal(result.sent, true);
  assert.equal(result.allPassed, true);
  assert.equal(batches.length, 1);
  const [message] = batches[0].messages;
  assert.equal(message.subject, '[TEST] Capacity report: team-jd.com.au is healthy');
  assert.deepEqual(message.to, ['ops@example.com']);
  assert.match(message.text, /\[PASS\] Site \/healthz: HTTP 200/);
  assert.match(message.text, /\[PASS\] Capacity monitor: last sample 20 s ago/);
  assert.match(message.text, /Host CPU: 12%/);
  assert.match(message.text, /Requests per minute: 55/);
  assert.match(batches[0].key, /^capacity-test-/);
});

test('a down site is reported in the email, not thrown', async () => {
  const { batches, provider } = recorder();
  const result = await runCapacityTest({
    env: ENV, provider, hostSampler, now: () => NOW,
    fetchImpl: async () => { throw new Error('connect ECONNREFUSED 127.0.0.1:3111'); },
    stateFile: await stateFile({ latest: snapshot })
  });

  assert.equal(result.sent, true);
  assert.equal(result.allPassed, false);
  assert.equal(result.checks.healthz, false);
  assert.equal(batches[0].messages[0].subject, '[TEST] Capacity report: team-jd.com.au is DOWN');
  assert.match(batches[0].messages[0].text, /\[FAIL\] Site \/healthz: not reachable on port 3111/);
});

test('an unready site (503) is reported as degraded', async () => {
  const { batches, provider } = recorder();
  await runCapacityTest({
    env: ENV, provider, hostSampler, now: () => NOW,
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ status: 'unavailable' }) }),
    stateFile: await stateFile({ latest: snapshot })
  });
  assert.match(batches[0].messages[0].subject, /DEGRADED/);
});

test('a stale or missing monitor snapshot fails the monitor check', async () => {
  const { provider } = recorder();
  const stale = await runCapacityTest({
    env: ENV, fetchImpl: healthy, provider, hostSampler, now: () => NOW,
    stateFile: await stateFile({ latest: { ...snapshot, writtenAt: NOW - 10 * 60000 } })
  });
  const missing = await runCapacityTest({ env: ENV, fetchImpl: healthy, provider, hostSampler, now: () => NOW, stateFile: await stateFile() });

  assert.equal(stale.checks.monitor, false);
  assert.equal(missing.checks.monitor, false);
});

test('staging reports the monitor as not enabled rather than failed', async () => {
  const { provider } = recorder();
  const result = await runCapacityTest({
    env: { ...ENV, APP_ENV: 'staging' }, fetchImpl: healthy, provider, hostSampler, now: () => NOW, stateFile: await stateFile()
  });
  assert.equal(result.checks.monitor, null);
  assert.equal(result.allPassed, true);
});

test('the test never changes the cooldown or breach state', async () => {
  const file = await stateFile({ latest: snapshot });
  const before = await fs.readFile(file, 'utf8');
  await runCapacityTest({ env: ENV, fetchImpl: healthy, provider: recorder().provider, hostSampler, now: () => NOW, stateFile: file });
  assert.equal(await fs.readFile(file, 'utf8'), before);
});

test('a Resend failure is returned so the command can exit non-zero', async () => {
  const result = await runCapacityTest({
    env: ENV, fetchImpl: healthy, hostSampler, now: () => NOW, stateFile: await stateFile({ latest: snapshot }),
    provider: { async sendBatch() { throw new Error('Resend rejected the email batch.'); } }
  });
  assert.equal(result.sent, false);
  assert.equal(result.sendError, 'Resend rejected the email batch.');
});

test('missing email settings are reported, not sent', async () => {
  const { batches, provider } = recorder();
  const result = await runCapacityTest({
    env: { PORT: '3111' }, fetchImpl: healthy, provider, hostSampler, now: () => NOW, stateFile: await stateFile()
  });
  assert.equal(result.sent, false);
  assert.equal(result.checks.config, false);
  assert.equal(batches.length, 0);
});

test('--env fills in what PM2 would set, without overriding the shell', () => {
  const staging = {};
  applyEnvFlag(['node', 'capacity-test.js', '--env', 'staging'], staging);
  assert.deepEqual(staging, { APP_ENV: 'staging', PORT: '3002' });

  const production = { PORT: '4000' };
  applyEnvFlag(['--env', 'production'], production);
  assert.deepEqual(production, { PORT: '4000' });

  const untouched = {};
  applyEnvFlag(['node', 'capacity-test.js'], untouched);
  assert.deepEqual(untouched, {});
  assert.throws(() => applyEnvFlag(['--env', 'prod'], {}), /must be/);
});
