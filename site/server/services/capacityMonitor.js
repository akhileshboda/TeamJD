const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { monitorEventLoopDelay } = require('node:perf_hooks');
const { createResendProvider } = require('./mail/resend');

// Capacity alert: samples host CPU, host RAM, Node event-loop lag and process
// memory, and emails (via Resend) when any of them stays above the threshold.
// One process per environment (see docs/deployment-oracle.md), and only the
// production process runs it, because staging shares the same host.

const DEFAULTS = {
  threshold: 0.8,
  cooldownHours: 6,
  sampleIntervalSeconds: 30,
  eventLoopMaxMs: 250,
  rssLimitMb: 300 // ecosystem.config.cjs max_memory_restart
};
// The delay histogram reports the timer period too, so an idle loop reads ~20 ms.
const LOOP_RESOLUTION_MS = 20;
const WINDOW_SAMPLES = 10;
const MIN_BREACHING_SAMPLES = 8;
const RETRY_AFTER_FAILURE_MS = 5 * 60 * 1000;
const STATE_FILE = path.resolve(__dirname, '..', '..', 'data', 'capacity-alert-state.json');

const pct = (ratio) => `${Math.round(ratio * 100)}%`;

// One entry per watched signal. `ratio` is the value as a share of its limit,
// so every signal is compared with the same threshold.
const SIGNALS = [
  { key: 'cpu', label: 'Host CPU', ratio: (s) => s.cpu, show: (s, r) => pct(r) },
  { key: 'ram', label: 'Host memory', ratio: (s) => s.ram, show: (s, r) => pct(r) },
  {
    key: 'eventLoop',
    label: 'Node event-loop lag (p99)',
    ratio: (s, limits) => (s.eventLoopMs == null ? null : s.eventLoopMs / limits.eventLoopMaxMs),
    show: (s, r, limits) => `${Math.round(s.eventLoopMs)} ms (${pct(r)} of the ${limits.eventLoopMaxMs} ms ceiling)`
  },
  {
    key: 'rss',
    label: 'Node process memory',
    ratio: (s, limits) => (s.rssBytes == null ? null : s.rssBytes / limits.rssLimitBytes),
    show: (s, r, limits) => `${Math.round(s.rssBytes / 1048576)} MB (${pct(r)} of the ${Math.round(limits.rssLimitBytes / 1048576)} MB PM2 cap)`
  }
];

function numberFrom(value, fallback, { min = -Infinity, max = Infinity } = {}) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

// assumeProduction: the test command runs from a shell without PM2's NODE_ENV.
function parseConfig(env = process.env, { assumeProduction = false } = {}) {
  const flag = String(env.CAPACITY_MONITOR_ENABLED || '').trim().toLowerCase();
  const defaultEnabled = (assumeProduction || env.NODE_ENV === 'production') && env.APP_ENV !== 'staging';
  const alertTo = String(env.CAPACITY_ALERT_TO || '').trim();
  const from = String(env.ENQUIRY_EMAIL_FROM || '').trim();
  const baseUrl = String(env.PUBLIC_BASE_URL || 'https://team-jd.com.au').trim();
  let siteName = 'team-jd.com.au';
  try { siteName = new URL(baseUrl).host; } catch (_error) { /* keep the default */ }

  return {
    enabled: flag === 'true' ? true : flag === 'false' ? false : defaultEnabled,
    envName: env.APP_ENV || 'production',
    siteName,
    threshold: numberFrom(env.CAPACITY_ALERT_THRESHOLD, DEFAULTS.threshold, { min: 0.01, max: 1 }),
    cooldownMs: numberFrom(env.CAPACITY_ALERT_COOLDOWN_HOURS, DEFAULTS.cooldownHours, { min: 0 }) * 3600000,
    intervalMs: numberFrom(env.CAPACITY_SAMPLE_INTERVAL_SECONDS, DEFAULTS.sampleIntervalSeconds, { min: 0.05 }) * 1000,
    limits: {
      eventLoopMaxMs: numberFrom(env.CAPACITY_EVENT_LOOP_MAX_MS, DEFAULTS.eventLoopMaxMs, { min: 1 }),
      rssLimitBytes: numberFrom(env.CAPACITY_RSS_LIMIT_MB, DEFAULTS.rssLimitMb, { min: 1 }) * 1048576
    },
    mail: {
      provider: String(env.ENQUIRY_MAIL_PROVIDER || '').trim(),
      apiKey: String(env.RESEND_API_KEY || '').trim(),
      from,
      alertTo
    }
  };
}

// Alerts need only the Resend key, a sender and a recipient (no reply-to).
function isAlertMailConfigured(config) {
  const { mail } = config;
  return Boolean(mail.provider === 'resend' && mail.apiKey && mail.from && mail.alertTo);
}

// ---- Measurements --------------------------------------------------------

// Used share of RAM from /proc/meminfo. MemAvailable (not "free") because the
// kernel keeps page cache in otherwise idle memory, which is not pressure.
function parseMeminfo(text) {
  const kb = (name) => {
    const match = new RegExp(`^${name}:\\s+(\\d+)\\s*kB`, 'm').exec(String(text));
    return match ? Number(match[1]) : null;
  };
  const total = kb('MemTotal');
  const available = kb('MemAvailable');
  if (!total || available == null) return null;
  return Math.min(1, Math.max(0, 1 - available / total));
}

async function readRamRatio(readFile = fs.readFile) {
  try {
    const parsed = parseMeminfo(await readFile('/proc/meminfo', 'utf8'));
    if (parsed != null) return parsed;
  } catch (_error) { /* not Linux: fall through */ }
  return 1 - os.freemem() / os.totalmem();
}

// Busy share of all cores since the previous call (null on the first call).
function createCpuReader(readCpus = os.cpus) {
  let previous = null;
  const totals = () => readCpus().reduce(
    (sum, { times }) => {
      const total = times.user + times.nice + times.sys + times.idle + times.irq;
      return { idle: sum.idle + times.idle, total: sum.total + total };
    },
    { idle: 0, total: 0 }
  );
  return () => {
    const current = totals();
    const before = previous;
    previous = current;
    if (!before || current.total <= before.total) return null;
    return 1 - (current.idle - before.idle) / (current.total - before.total);
  };
}

let requestCount = 0;
function requestCounter(_req, _res, next) {
  requestCount += 1;
  next();
}

function createSystemSampler({ now = Date.now } = {}) {
  const readCpu = createCpuReader();
  const loopDelay = monitorEventLoopDelay({ resolution: LOOP_RESOLUTION_MS });
  loopDelay.enable();
  let lastAt = now();
  let lastCount = requestCount;
  readCpu();

  return {
    async sample() {
      const at = now();
      const elapsedMs = Math.max(1, at - lastAt);
      const requests = requestCount - lastCount;
      lastAt = at;
      lastCount = requestCount;

      const eventLoopMs = loopDelay.count > 0
        ? Math.max(0, loopDelay.percentile(99) / 1e6 - LOOP_RESOLUTION_MS)
        : null;
      loopDelay.reset();

      return {
        at,
        cpu: readCpu(),
        ram: await readRamRatio(),
        eventLoopMs,
        rssBytes: process.memoryUsage().rss,
        requestsPerMin: (requests / elapsedMs) * 60000,
        uptimeSeconds: Math.floor(process.uptime())
      };
    },
    stop() {
      loopDelay.disable();
    }
  };
}

// ---- Email ---------------------------------------------------------------

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// kind: 'alert' | 'recovery' | 'test'. `rows` are [label, value, status?] where
// status is 'pass' | 'fail' | 'warn' | undefined.
function buildCapacityEmail({ kind, siteName, envName, headline, rows, notes = [] }) {
  const tag = { alert: '[CAPACITY]', recovery: '[CAPACITY OK]', test: '[TEST]' }[kind];
  const subject = `${tag} ${headline.subject}`;
  const mark = { pass: 'PASS', fail: 'FAIL', warn: 'WARN' };
  const color = { pass: '#157f4a', fail: '#c0392b', warn: '#b7791f' };

  const text = [
    headline.title,
    `${siteName} (${envName})`,
    '',
    ...rows.map(([label, value, status]) => `${status ? `[${mark[status]}] ` : ''}${label}: ${value}`),
    ...(notes.length ? ['', ...notes] : [])
  ].join('\n');

  const rowHtml = rows.map(([label, value, status]) => `
      <tr>
        <td style="padding:6px 12px 6px 0;color:#555">${escapeHtml(label)}</td>
        <td style="padding:6px 0"><strong>${escapeHtml(value)}</strong>${status
    ? ` <span style="color:${color[status]};font-weight:700">${mark[status]}</span>` : ''}</td>
      </tr>`).join('');
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111;max-width:560px">
    <h2 style="margin:0 0 4px">${escapeHtml(headline.title)}</h2>
    <p style="margin:0 0 16px;color:#555">${escapeHtml(siteName)} (${escapeHtml(envName)})</p>
    <table style="border-collapse:collapse">${rowHtml}</table>
    ${notes.map((note) => `<p style="margin:16px 0 0;color:#333">${escapeHtml(note)}</p>`).join('')}
  </div>`;

  return { subject, text, html };
}

function formatSignalRows(sample, limits, threshold) {
  return SIGNALS.map((signal) => {
    const ratio = signal.ratio(sample, limits);
    if (ratio == null) return [signal.label, 'no reading'];
    return [signal.label, signal.show(sample, ratio, limits), ratio > threshold ? 'warn' : undefined];
  });
}

function buildAlertEmail(context) {
  const { config, kind, breached, latest, peaks } = context;
  const worst = breached.reduce((a, b) => (peaks[b.key] > peaks[a.key] ? b : a));
  const latestRatio = worst.ratio(latest, config.limits);
  const subjectDetail = worst.key === 'eventLoop'
    ? `event-loop lag ${Math.round(latest.eventLoopMs ?? peaks.eventLoop * config.limits.eventLoopMaxMs)} ms`
    : `${worst.label.toLowerCase()} at ${pct(latestRatio ?? peaks[worst.key])}`;

  if (kind === 'recovery') {
    return buildCapacityEmail({
      kind,
      siteName: config.siteName,
      envName: config.envName,
      headline: { subject: `${config.siteName} is back under ${pct(config.threshold)}`, title: 'Load is back to normal' },
      rows: [
        ...formatSignalRows(latest, config.limits, config.threshold),
        ['Requests per minute', String(Math.round(latest.requestsPerMin))]
      ],
      notes: ['Every signal has stayed under the threshold for the whole sampling window.']
    });
  }

  return buildCapacityEmail({
    kind,
    siteName: config.siteName,
    envName: config.envName,
    headline: { subject: `${config.siteName}: ${subjectDetail}`, title: `Sustained load above ${pct(config.threshold)}` },
    rows: [
      ...formatSignalRows(latest, config.limits, config.threshold),
      ['Peak in window', breached.map((s) => `${s.label} ${pct(peaks[s.key])}`).join(', ')],
      ['Requests per minute', String(Math.round(latest.requestsPerMin))],
      ['Server uptime', `${Math.round(latest.uptimeSeconds / 60)} min`]
    ],
    notes: [
      `Over the last ${WINDOW_SAMPLES} samples, at least ${MIN_BREACHING_SAMPLES} were above ${pct(config.threshold)}. At most one alert is sent every ${config.cooldownMs / 3600000} hours.`,
      'Next steps: check `pm2 logs`, then consider a larger VM shape (see docs/deployment-oracle.md).'
    ]
  });
}

function createAlertSender(config, { provider, now = Date.now } = {}) {
  if (!isAlertMailConfigured(config)) return null;
  const mailer = provider || createResendProvider({ apiKey: config.mail.apiKey });
  return async function sendAlert(context) {
    const message = buildAlertEmail({ ...context, config });
    const hour = Math.floor(now() / 3600000);
    await mailer.sendBatch(
      [{ from: config.mail.from, to: [config.mail.alertTo], subject: message.subject, html: message.html, text: message.text }],
      `capacity-${context.kind}-${hour}`
    );
  };
}

// ---- State ---------------------------------------------------------------

async function readState(stateFile) {
  try {
    const parsed = JSON.parse(await fs.readFile(stateFile, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_error) {
    return {};
  }
}

// Atomic (tmp + rename) so the test command never reads a half-written file.
async function writeState(stateFile, state) {
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  const tmp = `${stateFile}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(state)}\n`);
  await fs.rename(tmp, stateFile);
}

// ---- Monitor -------------------------------------------------------------

function createCapacityMonitor({
  config,
  sampler,
  sendAlert = null,
  now = Date.now,
  stateFile = STATE_FILE,
  logger = console
}) {
  const window = [];
  let state = null;
  let retryAt = 0;
  let warnedUnconfigured = false;

  function evaluate() {
    const counts = {};
    const peaks = {};
    for (const signal of SIGNALS) {
      const ratios = window.map((entry) => signal.ratio(entry.sample, config.limits)).filter((r) => r != null);
      counts[signal.key] = ratios.filter((r) => r > config.threshold).length;
      peaks[signal.key] = ratios.length ? Math.max(...ratios) : 0;
    }
    const breached = SIGNALS.filter((s) => counts[s.key] >= MIN_BREACHING_SAMPLES);
    const calm = window.length >= WINDOW_SAMPLES && SIGNALS.every((s) => counts[s.key] === 0);
    return { breached, calm, peaks };
  }

  async function deliver(kind, breached, peaks, latest) {
    if (!sendAlert) {
      if (!warnedUnconfigured) {
        warnedUnconfigured = true;
        logger.warn('[capacity] CAPACITY_ALERT_TO (or the Resend settings) are not set; capacity emails are disabled.');
      }
      return false;
    }
    try {
      await sendAlert({ kind, breached, peaks, latest });
      logger.log(`[capacity] ${kind} email sent`);
      return true;
    } catch (error) {
      logger.error(`[capacity] ${kind} email failed: ${error.message}`);
      retryAt = now() + RETRY_AFTER_FAILURE_MS;
      return false;
    }
  }

  // Returns what happened, for the tests: 'alerted' | 'recovered' | 'idle'.
  async function tick() {
    const sample = await sampler.sample();
    window.push({ sample });
    if (window.length > WINDOW_SAMPLES) window.shift();
    if (!state) state = await readState(stateFile);

    const at = now();
    const { breached, calm, peaks } = evaluate();
    let outcome = 'idle';

    if (breached.length > 0) {
      const coolingDown = state.lastAlertAt && at - state.lastAlertAt < config.cooldownMs;
      if (!coolingDown && at >= retryAt && await deliver('alert', breached, peaks, sample)) {
        state.lastAlertAt = at;
        state.episodeAlerted = true;
        outcome = 'alerted';
      }
      state.breaching = true;
    } else if (state.breaching && calm) {
      state.breaching = false;
      if (state.episodeAlerted) {
        state.episodeAlerted = false;
        if (await deliver('recovery', SIGNALS, peaks, sample)) outcome = 'recovered';
      }
    }

    state.latest = { ...sample, writtenAt: at, intervalMs: config.intervalMs };
    try {
      await writeState(stateFile, state);
    } catch (error) {
      logger.error(`[capacity] could not save state: ${error.message}`);
    }
    return outcome;
  }

  return { tick };
}

let running = null;

function startCapacityMonitor(env = process.env, dependencies = {}) {
  const config = parseConfig(env);
  if (!config.enabled || running) return null;

  const sampler = dependencies.sampler || createSystemSampler();
  const monitor = createCapacityMonitor({
    config,
    sampler,
    sendAlert: createAlertSender(config, { provider: dependencies.provider }),
    ...dependencies.monitor
  });

  let busy = false;
  const timer = setInterval(() => {
    if (busy) return;
    busy = true;
    monitor.tick()
      .catch((error) => console.error(`[capacity] sample failed: ${error.message}`))
      .finally(() => { busy = false; });
  }, config.intervalMs);
  timer.unref();

  running = { timer, sampler };
  console.log(`[capacity] monitoring every ${config.intervalMs / 1000}s, alert threshold ${pct(config.threshold)}`);
  return running;
}

function stopCapacityMonitor() {
  if (!running) return;
  clearInterval(running.timer);
  running.sampler.stop?.();
  running = null;
}

module.exports = {
  DEFAULTS,
  MIN_BREACHING_SAMPLES,
  SIGNALS,
  STATE_FILE,
  WINDOW_SAMPLES,
  buildAlertEmail,
  buildCapacityEmail,
  createAlertSender,
  createCapacityMonitor,
  createCpuReader,
  createSystemSampler,
  formatSignalRows,
  isAlertMailConfigured,
  parseConfig,
  parseMeminfo,
  readRamRatio,
  readState,
  requestCounter,
  startCapacityMonitor,
  stopCapacityMonitor
};
