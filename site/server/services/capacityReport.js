const os = require('node:os');
const {
  buildCapacityEmail,
  createCpuReader,
  formatSignalRows,
  isAlertMailConfigured,
  parseConfig,
  readRamRatio,
  readState,
  STATE_FILE
} = require('./capacityMonitor');
const { createResendProvider } = require('./mail/resend');

// `npm run capacity:test`: sends one "[TEST]" health report through the same
// email builder and Resend path as the real alert. It never touches the
// cooldown or breach state, so a test cannot suppress a real alert.

// PM2 supplies APP_ENV and PORT from ecosystem.config.cjs, and an SSH shell does
// not, so `--env staging|production` stands in for them (ports as in the
// runtime contract). Values already in the environment win.
const ENV_PRESETS = { production: { PORT: '3000' }, staging: { APP_ENV: 'staging', PORT: '3002' } };

function applyEnvFlag(argv, env = process.env) {
  const index = argv.indexOf('--env');
  if (index === -1) return;
  const preset = ENV_PRESETS[argv[index + 1]];
  if (!preset) throw new Error('--env must be "production" or "staging".');
  for (const [key, value] of Object.entries(preset)) {
    if (!env[key]) env[key] = value;
  }
}

const SNAPSHOT_MAX_AGE_MS = 2 * 60 * 1000;

async function checkHealthz(port, fetchImpl) {
  const started = Date.now();
  try {
    const response = await fetchImpl(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(5000) });
    const body = await response.json().catch(() => ({}));
    return { reachable: true, ok: response.ok, status: response.status, latencyMs: Date.now() - started, uptimeSeconds: body.uptimeSeconds };
  } catch (error) {
    return { reachable: false, ok: false, error: error.message };
  }
}

// Host CPU needs two readings, so take them a second apart.
async function sampleHost(wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))) {
  const readCpu = createCpuReader();
  readCpu();
  await wait(1000);
  return { cpu: readCpu(), ram: await readRamRatio() };
}

async function runCapacityTest({
  env = process.env,
  fetchImpl = global.fetch,
  provider,
  stateFile = STATE_FILE,
  now = Date.now,
  hostSampler = sampleHost
} = {}) {
  const config = parseConfig(env, { assumeProduction: true });
  const port = Number(env.PORT) || 3000;
  const configured = isAlertMailConfigured(config);
  const health = await checkHealthz(port, fetchImpl);
  const host = await hostSampler();
  const snapshot = (await readState(stateFile)).latest || null;
  const snapshotAgeMs = snapshot ? now() - snapshot.writtenAt : null;
  const monitorFresh = snapshot != null && snapshotAgeMs <= Math.max(SNAPSHOT_MAX_AGE_MS, snapshot.intervalMs * 3);

  const checks = {
    config: configured,
    healthz: health.ok,
    monitor: config.enabled ? monitorFresh : null // null: not enabled here
  };
  const allPassed = Object.values(checks).every((value) => value !== false);

  // The live server's own readings win; the CLI's host reading fills the gaps.
  const reading = {
    cpu: host.cpu,
    ram: host.ram,
    eventLoopMs: snapshot?.eventLoopMs ?? null,
    rssBytes: snapshot?.rssBytes ?? null,
    requestsPerMin: snapshot?.requestsPerMin ?? 0
  };
  const state = health.ok ? 'healthy' : health.reachable ? 'DEGRADED' : 'DOWN';
  const status = (value) => (value === null ? undefined : value ? 'pass' : 'fail');

  const message = buildCapacityEmail({
    kind: 'test',
    siteName: config.siteName,
    envName: config.envName,
    headline: { subject: `Capacity report: ${config.siteName} is ${state}`, title: `Health report: ${state}` },
    rows: [
      ['Alert email settings', configured ? `sending to ${config.mail.alertTo}` : 'CAPACITY_ALERT_TO, RESEND_API_KEY or ENQUIRY_EMAIL_FROM missing', status(configured)],
      ['Site /healthz', health.reachable
        ? `HTTP ${health.status} in ${health.latencyMs} ms, up ${Math.round((health.uptimeSeconds || 0) / 60)} min`
        : `not reachable on port ${port} (${health.error})`, status(health.ok)],
      ['Capacity monitor', config.enabled
        ? (snapshot ? `last sample ${Math.round(snapshotAgeMs / 1000)} s ago` : 'no samples recorded yet')
        : 'not enabled in this environment', status(checks.monitor)],
      ...formatSignalRows(reading, config.limits, config.threshold),
      ['Requests per minute', String(Math.round(reading.requestsPerMin))],
      ['Host', `${os.cpus().length} cores, ${Math.round(os.totalmem() / 1048576)} MB RAM`]
    ],
    notes: [
      'This is a test email from `npm run capacity:test`. It does not change the alert cooldown.',
      'If this arrived, Resend delivery works. Real alerts use the same template.'
    ]
  });

  let sendError = null;
  if (configured) {
    try {
      const mailer = provider || createResendProvider({ apiKey: config.mail.apiKey });
      await mailer.sendBatch(
        [{ from: config.mail.from, to: [config.mail.alertTo], subject: message.subject, html: message.html, text: message.text }],
        `capacity-test-${now()}`
      );
    } catch (error) {
      sendError = error.message;
    }
  } else {
    sendError = 'Capacity alert email is not configured.';
  }

  return { sent: sendError === null, sendError, allPassed, checks, health, subject: message.subject };
}

module.exports = { applyEnvFlag, runCapacityTest, sampleHost, checkHealthz };
