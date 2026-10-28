const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  MIN_BREACHING_SAMPLES,
  WINDOW_SAMPLES,
  buildAlertEmail,
  createAlertSender,
  createCapacityMonitor,
  createCpuReader,
  parseConfig,
  parseMeminfo,
  readState,
  startCapacityMonitor,
  stopCapacityMonitor
} = require('./capacityMonitor');

const HOUR = 3600000;
const quiet = { warn() {}, error() {}, log() {} };
const MAIL_ENV = {
  ENQUIRY_MAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 'resend-key',
  ENQUIRY_EMAIL_FROM: 'Team JD <enquiries@send.team-jd.com.au>',
  CAPACITY_ALERT_TO: 'ops@example.com',
  NODE_ENV: 'production'
};

async function tempState() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'capacity-'));
  return { dir, file: path.join(dir, 'state.json') };
}

// A sampler that replays a list of CPU readings (other signals stay idle).
function scriptedSampler(cpuReadings, clock) {
  let index = 0;
  return {
    async sample() {
      const cpu = cpuReadings[Math.min(index, cpuReadings.length - 1)];
      index += 1;
      return { at: clock.now, cpu, ram: 0.3, eventLoopMs: 5, rssBytes: 100 * 1048576, requestsPerMin: 42, uptimeSeconds: 600 };
    },
    stop() {}
  };
}

function setup(cpuReadings, { env = MAIL_ENV, send, stateFile } = {}) {
  const clock = { now: Date.UTC(2026, 9, 26, 12) };
  const sent = [];
  const sendAlert = send === null ? null : (send || (async (context) => { sent.push(context); }));
  const monitor = createCapacityMonitor({
    config: parseConfig(env),
    sampler: scriptedSampler(cpuReadings, clock),
    sendAlert,
    now: () => clock.now,
    stateFile,
    logger: quiet
  });
  const step = async (count = 1) => {
    const outcomes = [];
    for (let i = 0; i < count; i += 1) {
      clock.now += 30000;
      outcomes.push(await monitor.tick());
    }
    return outcomes;
  };
  return { clock, sent, monitor, step };
}

const high = (n) => Array(n).fill(0.95);
const low = (n) => Array(n).fill(0.2);

test('a sustained breach sends exactly one alert email', async () => {
  const { file } = await tempState();
  const { sent, step } = setup(high(30), { stateFile: file });
  const outcomes = await step(30);

  assert.equal(outcomes.filter((o) => o === 'alerted').length, 1);
  assert.equal(outcomes.indexOf('alerted'), MIN_BREACHING_SAMPLES - 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].kind, 'alert');
  assert.deepEqual(sent[0].breached.map((s) => s.key), ['cpu']);
});

test('a single spike does not alert', async () => {
  const { file } = await tempState();
  const { sent, step } = setup([...low(5), 0.99, ...low(20)], { stateFile: file });
  await step(26);
  assert.equal(sent.length, 0);
});

test('a brief burst shorter than the window does not alert', async () => {
  const { file } = await tempState();
  const { sent, step } = setup([...low(3), ...high(MIN_BREACHING_SAMPLES - 1), ...low(20)], { stateFile: file });
  await step(30);
  assert.equal(sent.length, 0);
});

test('event-loop lag and process memory are watched too', async () => {
  const { file } = await tempState();
  const clock = { now: Date.UTC(2026, 9, 26, 12) };
  const sent = [];
  const monitor = createCapacityMonitor({
    config: parseConfig(MAIL_ENV),
    sampler: {
      async sample() {
        return { at: clock.now, cpu: 0.1, ram: 0.1, eventLoopMs: 230, rssBytes: 100 * 1048576, requestsPerMin: 900, uptimeSeconds: 10 };
      }
    },
    sendAlert: async (context) => { sent.push(context); },
    now: () => clock.now,
    stateFile: file,
    logger: quiet
  });
  for (let i = 0; i < WINDOW_SAMPLES; i += 1) {
    clock.now += 30000;
    await monitor.tick();
  }
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].breached.map((s) => s.key), ['eventLoop']);
});

test('the cooldown holds across a restart through the state file', async () => {
  const { file } = await tempState();
  const first = setup(high(20), { stateFile: file });
  await first.step(MIN_BREACHING_SAMPLES);
  assert.equal(first.sent.length, 1);

  // A new monitor (the PM2 restart) 2 hours later, still overloaded.
  const second = setup(high(20), { stateFile: file });
  second.clock.now = first.clock.now + 2 * HOUR;
  await second.step(MIN_BREACHING_SAMPLES + 2);
  assert.equal(second.sent.length, 0);

  // Past the 6 hour cooldown it reminds again.
  second.clock.now = first.clock.now + 7 * HOUR;
  await second.step(1);
  assert.equal(second.sent.length, 1);
});

test('a recovery email follows once load has been calm for a full window', async () => {
  const { file } = await tempState();
  const { sent, step } = setup([...high(MIN_BREACHING_SAMPLES), ...low(40)], { stateFile: file });
  const outcomes = await step(MIN_BREACHING_SAMPLES + WINDOW_SAMPLES + 2);

  assert.deepEqual(sent.map((s) => s.kind), ['alert', 'recovery']);
  assert.equal(outcomes.filter((o) => o === 'recovered').length, 1);
});

test('no recovery email is sent for a breach that never alerted', async () => {
  const { file } = await tempState();
  const { sent, step } = setup([...high(MIN_BREACHING_SAMPLES), ...low(40)], { stateFile: file, send: null });
  await step(MIN_BREACHING_SAMPLES + WINDOW_SAMPLES + 2);
  assert.equal(sent.length, 0);
});

test('missing email settings send nothing and never throw', async () => {
  const { file } = await tempState();
  const { sent, step } = setup(high(20), { env: { NODE_ENV: 'production' }, stateFile: file, send: null });
  await assert.doesNotReject(step(20));
  assert.equal(sent.length, 0);
  assert.equal(createAlertSender(parseConfig({ NODE_ENV: 'production' })), null);
});

test('a failing provider is swallowed and retried after a pause, not every tick', async () => {
  const { file } = await tempState();
  let attempts = 0;
  const { clock, step, monitor } = setup(high(60), {
    stateFile: file,
    send: async () => { attempts += 1; throw new Error('Resend could not be reached.'); }
  });
  await assert.doesNotReject(step(MIN_BREACHING_SAMPLES + 4));
  assert.equal(attempts, 1);

  clock.now += 6 * 60 * 1000;
  assert.equal(await monitor.tick(), 'idle');
  assert.equal(attempts, 2);
  assert.equal((await readState(file)).lastAlertAt, undefined);
});

test('state is saved atomically with the latest sample for the test command', async () => {
  const { dir, file } = await tempState();
  const { step } = setup(low(3), { stateFile: file });
  await step(2);

  const state = await readState(file);
  assert.equal(state.latest.cpu, 0.2);
  assert.equal(state.latest.requestsPerMin, 42);
  assert.ok(state.latest.writtenAt > 0);
  assert.deepEqual((await fs.readdir(dir)).filter((name) => name.endsWith('.tmp')), []);
});

test('the monitor only runs in the production process', () => {
  assert.equal(parseConfig({ ...MAIL_ENV, APP_ENV: 'staging' }).enabled, false);
  assert.equal(parseConfig({ NODE_ENV: 'production' }).enabled, true);
  assert.equal(parseConfig({}).enabled, false);
  assert.equal(parseConfig({ NODE_ENV: 'production', CAPACITY_MONITOR_ENABLED: 'false' }).enabled, false);
  assert.equal(parseConfig({ CAPACITY_MONITOR_ENABLED: 'true' }).enabled, true);
  assert.equal(startCapacityMonitor({ ...MAIL_ENV, APP_ENV: 'staging' }), null);
});

test('start schedules an unref-ed timer and stop clears it', () => {
  let samples = 0;
  const handle = startCapacityMonitor(
    { ...MAIL_ENV, CAPACITY_SAMPLE_INTERVAL_SECONDS: '0.05' },
    { sampler: { async sample() { samples += 1; return { cpu: 0, ram: 0, eventLoopMs: 0, rssBytes: 0, requestsPerMin: 0, uptimeSeconds: 0 }; } }, monitor: { stateFile: path.join(os.tmpdir(), `capacity-start-${process.pid}.json`) } }
  );
  assert.ok(handle);
  assert.equal(handle.timer.hasRef(), false);
  assert.equal(startCapacityMonitor(MAIL_ENV), null, 'a second start is ignored');
  stopCapacityMonitor();
  assert.equal(samples, 0);
});

test('invalid settings fall back to safe defaults', () => {
  const config = parseConfig({ ...MAIL_ENV, CAPACITY_ALERT_THRESHOLD: 'banana', CAPACITY_ALERT_COOLDOWN_HOURS: '-3' });
  assert.equal(config.threshold, 0.8);
  assert.equal(config.cooldownMs, 6 * HOUR);
});

test('parseMeminfo uses MemAvailable, not free memory', () => {
  const fixture = 'MemTotal:        1000000 kB\nMemFree:           50000 kB\nMemAvailable:     600000 kB\nBuffers: 1 kB\n';
  assert.equal(parseMeminfo(fixture), 0.4);
  assert.equal(parseMeminfo('MemTotal: 10 kB\n'), null);
  assert.equal(parseMeminfo(''), null);
});

test('cpu reader reports the busy share since the previous call', () => {
  const cpus = (idle, busy) => () => [{ times: { user: busy, nice: 0, sys: 0, idle, irq: 0 } }];
  let reading = cpus(100, 0);
  const read = createCpuReader(() => reading());
  assert.equal(read(), null);
  reading = cpus(130, 90);
  assert.equal(read(), 0.75);
});

test('the alert email names the worst signal, the environment and the next step', () => {
  const config = parseConfig({ ...MAIL_ENV, APP_ENV: 'production', PUBLIC_BASE_URL: 'https://team-jd.com.au' });
  const latest = { cpu: 0.87, ram: 0.4, eventLoopMs: 12, rssBytes: 120 * 1048576, requestsPerMin: 321, uptimeSeconds: 7200 };
  const cpu = require('./capacityMonitor').SIGNALS[0];
  const message = buildAlertEmail({
    config, kind: 'alert', breached: [cpu], latest, peaks: { cpu: 0.93, ram: 0.4, eventLoop: 0.05, rss: 0.4 }
  });

  assert.equal(message.subject, '[CAPACITY] team-jd.com.au: host cpu at 87%');
  assert.match(message.text, /Requests per minute: 321/);
  assert.match(message.text, /pm2 logs/);
  assert.match(message.html, /team-jd\.com\.au \(production\)/);
});
