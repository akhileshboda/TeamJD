const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const siteRoot = path.resolve(__dirname, '..');
const productionWrapper = path.join(__dirname, 'deploy-production.sh');
const stagingWrapper = path.join(__dirname, 'deploy-staging.sh');

function writeExecutable(filePath, contents) {
  fs.writeFileSync(filePath, contents, { mode: 0o755 });
}

function writeEnvironment(filePath, environment, overrides = {}) {
  const values = {
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: environment === 'production' ? '3000' : '3002',
    ASSET_AUTO_SYNC_ENABLED: environment === 'production' ? 'true' : 'false',
    ASSET_SYNC_ON_BOOT: 'false',
    ...overrides
  };

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n')}\n`
  );
}

function createHarness(t) {
  const tempRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'teamjd-deploy-')));
  const binDir = path.join(tempRoot, 'bin');
  const callerDir = path.join(tempRoot, 'caller');
  const productionRoot = path.join(tempRoot, 'var', 'www', 'teamjd');
  const stagingRoot = path.join(tempRoot, 'var', 'www', 'teamjd-staging');
  const eventLog = path.join(tempRoot, 'events.jsonl');
  const pm2State = path.join(tempRoot, 'pm2-state.json');

  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(callerDir, { recursive: true });
  fs.writeFileSync(pm2State, JSON.stringify({ nextPid: 5000, processes: {}, saved: [] }));

  writeExecutable(
    path.join(binDir, 'ssh'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const replacements = [
  ['/var/www/teamjd-staging', process.env.FAKE_STAGING_ROOT],
  ['/var/www/teamjd', process.env.FAKE_PRODUCTION_ROOT]
];
function map(value) {
  if (value.includes(process.env.FAKE_STAGING_ROOT) || value.includes(process.env.FAKE_PRODUCTION_ROOT)) return value;
  return value
    .split(replacements[0][0]).join('__TEAMJD_STAGING__')
    .split(replacements[1][0]).join('__TEAMJD_PRODUCTION__')
    .split('__TEAMJD_STAGING__').join(replacements[0][1])
    .split('__TEAMJD_PRODUCTION__').join(replacements[1][1]);
}
const input = map(fs.readFileSync(0, 'utf8'));
const args = process.argv.slice(2);
if (args.length < 5 || args[1] !== 'bash' || args[2] !== '-s' || args[3] !== '--') process.exit(90);
const rawRemoteArgs = args.slice(4);
// OpenSSH builds one remote command string. Empty local argv entries do not survive
// parsing by the remote shell, which is what exposed the former production $6 bug.
const flattenedRemoteArgs = rawRemoteArgs.filter((argument) => argument !== '');
fs.appendFileSync(process.env.FAKE_EVENT_LOG, JSON.stringify({
  command: 'ssh',
  rawRemoteArgs,
  flattenedRemoteArgs
}) + '\\n');
const result = spawnSync('bash', ['-s', '--', ...flattenedRemoteArgs.map(map)], {
  input,
  encoding: 'utf8',
  env: process.env
});
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
process.exit(result.status ?? 91);
`
  );

  writeExecutable(
    path.join(binDir, 'rsync'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const source = args.at(-2).replace(/\\/$/, '');
const destinationArgument = args.at(-1);
const replacements = [
  ['/var/www/teamjd-staging', process.env.FAKE_STAGING_ROOT],
  ['/var/www/teamjd', process.env.FAKE_PRODUCTION_ROOT]
];
function map(value) {
  if (value.includes(process.env.FAKE_STAGING_ROOT) || value.includes(process.env.FAKE_PRODUCTION_ROOT)) return value;
  return value
    .split(replacements[0][0]).join('__TEAMJD_STAGING__')
    .split(replacements[1][0]).join('__TEAMJD_PRODUCTION__')
    .split('__TEAMJD_STAGING__').join(replacements[0][1])
    .split('__TEAMJD_PRODUCTION__').join(replacements[1][1]);
}
function copyIfPresent(name, destination) {
  const sourcePath = path.join(source, name);
  if (!fs.existsSync(sourcePath)) return;
  fs.cpSync(sourcePath, path.join(destination, name), { recursive: true, force: true });
}
const remoteUpload = destinationArgument.includes(':');
const destination = map(remoteUpload ? destinationArgument.slice(destinationArgument.indexOf(':') + 1) : destinationArgument).replace(/\\/$/, '');
fs.mkdirSync(destination, { recursive: true });
for (const name of ['ecosystem.config.cjs', 'package.json', 'package-lock.json', 'node_modules']) {
  copyIfPresent(name, destination);
}
fs.writeFileSync(path.join(destination, 'payload-ready'), 'ready');
if (!remoteUpload) {
  for (const staleName of ['stale.txt', '.git', '.agent', '.claude', '.codex', '.idea', '.vscode']) {
    fs.rmSync(path.join(destination, staleName), { recursive: true, force: true });
  }
}
fs.appendFileSync(process.env.FAKE_EVENT_LOG, JSON.stringify({
  command: 'rsync',
  kind: remoteUpload ? 'upload' : 'promote',
  args
}) + '\\n');
`
  );

  writeExecutable(
    path.join(binDir, 'npm'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const cwd = process.cwd();
fs.appendFileSync(process.env.FAKE_EVENT_LOG, JSON.stringify({
  command: 'npm',
  cwd,
  args,
  activeStaleAtInstall: args[0] === 'ci' ? fs.existsSync(path.join(path.dirname(cwd), 'stale.txt')) : null
}) + '\\n');
if (args[0] === 'ci') {
  fs.mkdirSync(path.join(cwd, 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'node_modules', '.installed'), 'installed');
}
`
  );

  writeExecutable(
    path.join(binDir, 'pm2'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const statePath = process.env.FAKE_PM2_STATE;
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
function persist() {
  fs.writeFileSync(statePath, JSON.stringify(state));
}
function log(extra = {}) {
  fs.appendFileSync(process.env.FAKE_EVENT_LOG, JSON.stringify({
    command: 'pm2',
    cwd: process.cwd(),
    args,
    ...extra
  }) + '\\n');
}
switch (args[0]) {
  case 'pid': {
    const target = state.processes[args[1]];
    log({ resultPid: target?.pid || 0 });
    process.stdout.write(String(target?.pid || 0) + '\\n');
    break;
  }
  case 'delete': {
    const existed = Boolean(state.processes[args[1]]);
    delete state.processes[args[1]];
    persist();
    log({ existed });
    if (!existed) process.exitCode = 1;
    break;
  }
  case 'start': {
    log();
    if (process.env.FAKE_PM2_START_FAIL === 'true') process.exit(1);
    const onlyIndex = args.indexOf('--only');
    const name = onlyIndex >= 0 ? args[onlyIndex + 1] : '';
    const config = require(path.resolve(process.cwd(), args[1]));
    const app = config.apps.find((candidate) => candidate.name === name);
    if (!app) process.exit(2);
    state.nextPid += 1;
    state.processes[name] = {
      name,
      pid: state.nextPid,
      cwd: app.cwd,
      status: 'online',
      env: { ...app.env }
    };
    persist();
    break;
  }
  case 'jlist': {
    log();
    const list = Object.values(state.processes).map((entry) => ({
      name: entry.name,
      pid: entry.pid,
      pm2_env: {
        status: entry.status,
        pm_cwd: entry.cwd,
        ...entry.env
      }
    }));
    process.stdout.write(JSON.stringify(list));
    break;
  }
  case 'save': {
    state.saved = Object.keys(state.processes).sort();
    persist();
    log({ saved: state.saved });
    break;
  }
  default:
    log();
    process.exitCode = 3;
}
`
  );

  writeExecutable(
    path.join(binDir, 'curl'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_EVENT_LOG, JSON.stringify({
  command: 'curl',
  cwd: process.cwd(),
  args
}) + '\\n');
if (process.env.FAKE_HEALTH_FAIL === 'true') process.exit(22);
const state = JSON.parse(fs.readFileSync(process.env.FAKE_PM2_STATE, 'utf8'));
const url = args.at(-1);
const port = new URL(url).port;
const healthy = Object.values(state.processes).some((entry) => (
  entry.status === 'online' && String(entry.env.PORT) === port
));
if (!healthy) process.exit(7);
process.stdout.write('{"status":"ok"}');
`
  );

  writeExecutable(
    path.join(binDir, 'sleep'),
    `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.FAKE_EVENT_LOG, JSON.stringify({
  command: 'sleep',
  args: process.argv.slice(2)
}) + '\\n');
`
  );

  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  return {
    callerDir,
    eventLog,
    pm2State,
    productionRoot,
    stagingRoot,
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      DEPLOY_USER: 'tester',
      DEPLOY_HOST: 'oracle.example',
      DEPLOY_RUN_SYNC: 'false',
      FAKE_PRODUCTION_ROOT: productionRoot,
      FAKE_STAGING_ROOT: stagingRoot,
      FAKE_EVENT_LOG: eventLog,
      FAKE_PM2_STATE: pm2State
    }
  };
}

function runDeploy(harness, environment) {
  return spawnSync('bash', [environment === 'production' ? productionWrapper : stagingWrapper], {
    cwd: harness.callerDir,
    env: harness.env,
    encoding: 'utf8'
  });
}

function readEvents(harness) {
  if (!fs.existsSync(harness.eventLog)) return [];
  return fs.readFileSync(harness.eventLog, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
}

function readPm2State(harness) {
  return JSON.parse(fs.readFileSync(harness.pm2State, 'utf8'));
}

function seedPm2Process(harness, { name, pid, cwd, port, nodeEnv = 'production' }) {
  const state = readPm2State(harness);
  state.nextPid = Math.max(state.nextPid, pid);
  state.processes[name] = {
    name,
    pid,
    cwd,
    status: 'online',
    env: { PORT: String(port), NODE_ENV: nodeEnv, HOST: '127.0.0.1' }
  };
  fs.writeFileSync(harness.pm2State, JSON.stringify(state));
}

function assertFreshLifecycle(events, processName, previousPid, expectedPort) {
  const pidEvent = events.find((event) => event.command === 'pm2' && event.args.join(' ') === `pid ${processName}`);
  const deleteIndex = events.findIndex((event) => event.command === 'pm2' && event.args.join(' ') === `delete ${processName}`);
  const startIndex = events.findIndex((event) => (
    event.command === 'pm2' &&
    event.args[0] === 'start' &&
    event.args.includes(processName)
  ));
  const healthIndex = events.findIndex((event) => (
    event.command === 'curl' && event.args.some((argument) => argument.includes(`:${expectedPort}/healthz`))
  ));
  const saveIndex = events.findIndex((event) => event.command === 'pm2' && event.args[0] === 'save');

  assert.equal(pidEvent.resultPid, previousPid);
  assert.ok(deleteIndex >= 0 && deleteIndex < startIndex);
  assert.ok(startIndex < healthIndex && healthIndex < saveIndex);
  assert.equal(events.some((event) => event.command === 'pm2' && event.args[0] === 'startOrRestart'), false);
}

test('real rsync promotion preserves runtime state while deleting stale application files', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'teamjd-rsync-'));
  const deployRoot = path.join(tempRoot, 'teamjd');
  const incomingRoot = path.join(deployRoot, '.deploy-incoming');
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  fs.mkdirSync(path.join(incomingRoot, 'server'), { recursive: true });
  fs.mkdirSync(path.join(deployRoot, 'data'), { recursive: true });
  fs.mkdirSync(path.join(deployRoot, 'public', 'assets', 'generated'), { recursive: true });
  fs.writeFileSync(path.join(incomingRoot, 'server', 'app.js'), 'new application');
  fs.writeFileSync(path.join(deployRoot, '.env'), 'secret=true\n');
  fs.writeFileSync(path.join(deployRoot, 'data', 'state.json'), '{}');
  fs.writeFileSync(path.join(deployRoot, 'public', 'assets', 'generated', 'asset.webp'), 'asset');
  fs.writeFileSync(path.join(deployRoot, 'stale.txt'), 'stale');

  const result = spawnSync('rsync', [
    '-a',
    '--delete',
    '--exclude', '/.deploy-incoming/',
    '--exclude', '/.env',
    '--exclude', '/data/',
    '--exclude', '/public/assets/generated/',
    `${incomingRoot}/`,
    `${deployRoot}/`
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.readFileSync(path.join(deployRoot, 'server', 'app.js'), 'utf8'), 'new application');
  assert.equal(fs.readFileSync(path.join(deployRoot, '.env'), 'utf8'), 'secret=true\n');
  assert.equal(fs.readFileSync(path.join(deployRoot, 'data', 'state.json'), 'utf8'), '{}');
  assert.equal(
    fs.readFileSync(path.join(deployRoot, 'public', 'assets', 'generated', 'asset.webp'), 'utf8'),
    'asset'
  );
  assert.equal(fs.existsSync(path.join(deployRoot, 'stale.txt')), false);
  assert.equal(fs.existsSync(incomingRoot), true);
});

test('production drops no SSH arguments and replaces the PM2 process on every deploy', (t) => {
  const harness = createHarness(t);
  const legacyRoot = path.join(harness.productionRoot, 'site');
  const oldPid = 4100;

  writeEnvironment(path.join(legacyRoot, '.env'), 'production');
  fs.mkdirSync(path.join(legacyRoot, 'data'), { recursive: true });
  fs.mkdirSync(path.join(legacyRoot, 'public', 'assets', 'generated'), { recursive: true });
  fs.writeFileSync(path.join(legacyRoot, 'data', 'state.json'), '{}');
  fs.writeFileSync(path.join(legacyRoot, 'public', 'assets', 'generated', 'asset.webp'), 'asset');
  fs.mkdirSync(path.join(harness.productionRoot, '.deploy-incoming'), { recursive: true });
  fs.writeFileSync(path.join(harness.productionRoot, '.deploy-incoming', 'abandoned'), 'stale');
  fs.mkdirSync(path.join(harness.productionRoot, '.git'), { recursive: true });
  fs.writeFileSync(path.join(harness.productionRoot, 'stale.txt'), 'stale');
  seedPm2Process(harness, {
    name: 'jake-production', pid: oldPid, cwd: harness.productionRoot, port: 3000
  });
  seedPm2Process(harness, {
    name: 'jake-staging', pid: 4150, cwd: harness.stagingRoot, port: 3002
  });

  const firstRun = runDeploy(harness, 'production');
  assert.equal(firstRun.status, 0, firstRun.stderr || firstRun.stdout);
  assert.equal(fs.existsSync(legacyRoot), false);
  assert.equal(fs.existsSync(path.join(harness.productionRoot, '.deploy-incoming')), false);
  assert.equal(fs.existsSync(path.join(harness.productionRoot, 'stale.txt')), false);
  assert.equal(fs.existsSync(path.join(harness.productionRoot, '.git')), false);
  assert.equal(fs.readFileSync(path.join(harness.productionRoot, 'data', 'state.json'), 'utf8'), '{}');
  assert.equal(
    fs.readFileSync(path.join(harness.productionRoot, 'public', 'assets', 'generated', 'asset.webp'), 'utf8'),
    'asset'
  );

  const events = readEvents(harness);
  const sshEvents = events.filter((event) => event.command === 'ssh');
  assert.ok(sshEvents.length >= 2);
  for (const event of sshEvents) {
    assert.deepEqual(event.rawRemoteArgs, ['production']);
    assert.deepEqual(event.flattenedRemoteArgs, ['production']);
  }
  const upload = events.find((event) => event.command === 'rsync' && event.kind === 'upload');
  const installIndex = events.findIndex((event) => event.command === 'npm' && event.args[0] === 'ci');
  const promoteIndex = events.findIndex((event) => event.command === 'rsync' && event.kind === 'promote');
  assert.ok(upload.args.includes(`${siteRoot}/`));
  assert.equal(upload.args.at(-1), 'tester@oracle.example:/var/www/teamjd/.deploy-incoming/');
  assert.ok(installIndex >= 0 && installIndex < promoteIndex);
  assert.equal(events[installIndex].activeStaleAtInstall, true);
  assertFreshLifecycle(events, 'jake-production', oldPid, 3000);

  const firstState = readPm2State(harness);
  const firstNewPid = firstState.processes['jake-production'].pid;
  assert.notEqual(firstNewPid, oldPid);
  assert.equal(firstState.processes['jake-production'].cwd, harness.productionRoot);
  assert.equal(firstState.processes['jake-production'].env.PORT, '3000');
  assert.equal(firstState.processes['jake-production'].env.NODE_ENV, 'production');
  assert.equal(firstState.processes['jake-staging'].pid, 4150);
  assert.deepEqual(firstState.saved, ['jake-production', 'jake-staging']);

  harness.env.DEPLOY_RUN_SYNC = 'true';
  const repeatRun = runDeploy(harness, 'production');
  assert.equal(repeatRun.status, 0, repeatRun.stderr || repeatRun.stdout);
  const repeatState = readPm2State(harness);
  assert.notEqual(repeatState.processes['jake-production'].pid, firstNewPid);
  const repeatEvents = readEvents(harness);
  assert.ok(repeatEvents.some(
    (event) => event.command === 'npm' && event.args.join(' ') === 'run sync-assets'
  ));
  assert.ok(repeatEvents.filter((event) => event.command === 'ssh').every(
    (event) => event.rawRemoteArgs.length === 1 && event.rawRemoteArgs[0] === 'production'
  ));
});

test('staging accepts legacy env values, removes the legacy process, and remains isolated', (t) => {
  const harness = createHarness(t);
  const productionManifest = path.join(harness.productionRoot, 'data', 'asset-manifest.json');
  const legacyPid = 4200;

  writeEnvironment(path.join(harness.productionRoot, '.env'), 'production');
  fs.mkdirSync(path.dirname(productionManifest), { recursive: true });
  fs.writeFileSync(productionManifest, '{"source":"production"}\n');
  fs.writeFileSync(path.join(harness.productionRoot, 'production-only'), 'keep');

  writeEnvironment(path.join(harness.stagingRoot, '.env'), 'staging', {
    NODE_ENV: 'staging',
    HOST: 'localhost',
    ASSET_SYNC_ON_BOOT: 'true'
  });
  fs.mkdirSync(path.join(harness.stagingRoot, 'data'), { recursive: true });
  fs.mkdirSync(path.join(harness.stagingRoot, 'public', 'assets', 'generated'), { recursive: true });
  fs.writeFileSync(path.join(harness.stagingRoot, 'data', 'staging-only'), 'keep');
  fs.writeFileSync(path.join(harness.stagingRoot, 'public', 'assets', 'generated', 'stage.webp'), 'stage');
  fs.writeFileSync(path.join(harness.stagingRoot, 'stale.txt'), 'stale');
  seedPm2Process(harness, {
    name: 'jake-site-staging', pid: legacyPid, cwd: harness.stagingRoot, port: 3002, nodeEnv: 'staging'
  });
  seedPm2Process(harness, {
    name: 'jake-production', pid: 4250, cwd: harness.productionRoot, port: 3000
  });

  const result = runDeploy(harness, 'staging');
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(
    fs.readFileSync(path.join(harness.stagingRoot, 'data', 'asset-manifest.json'), 'utf8'),
    '{"source":"production"}\n'
  );
  assert.equal(fs.readFileSync(path.join(harness.stagingRoot, 'data', 'staging-only'), 'utf8'), 'keep');
  assert.equal(
    fs.readFileSync(path.join(harness.stagingRoot, 'public', 'assets', 'generated', 'stage.webp'), 'utf8'),
    'stage'
  );
  assert.equal(fs.readFileSync(path.join(harness.productionRoot, 'production-only'), 'utf8'), 'keep');
  assert.equal(fs.existsSync(path.join(harness.stagingRoot, 'stale.txt')), false);

  const events = readEvents(harness);
  const upload = events.find((event) => event.command === 'rsync' && event.kind === 'upload');
  assert.equal(upload.args.at(-1), 'tester@oracle.example:/var/www/teamjd-staging/.deploy-incoming/');
  assert.ok(events.some(
    (event) => event.command === 'pm2' && event.args.join(' ') === 'pid jake-staging' && event.resultPid === 0
  ));
  assert.ok(events.some(
    (event) => event.command === 'pm2' && event.args.join(' ') === 'pid jake-site-staging' && event.resultPid === legacyPid
  ));
  assert.ok(events.some(
    (event) => event.command === 'pm2' && event.args.join(' ') === 'delete jake-site-staging'
  ));
  assertFreshLifecycle(events, 'jake-staging', 0, 3002);
  assert.ok(events.filter((event) => event.command === 'ssh').every(
    (event) => event.rawRemoteArgs.length === 1 && event.rawRemoteArgs[0] === 'staging'
  ));

  const state = readPm2State(harness);
  assert.equal(state.processes['jake-site-staging'], undefined);
  assert.equal(state.processes['jake-staging'].cwd, harness.stagingRoot);
  assert.equal(state.processes['jake-staging'].env.PORT, '3002');
  assert.equal(state.processes['jake-staging'].env.NODE_ENV, 'production');
  assert.equal(state.processes['jake-staging'].env.ASSET_AUTO_SYNC_ENABLED, 'false');
  assert.equal(state.processes['jake-staging'].env.ASSET_SYNC_ON_BOOT, 'false');
  assert.equal(state.processes['jake-production'].pid, 4250);
  assert.deepEqual(state.saved, ['jake-production', 'jake-staging']);

  const eventCount = events.length;
  harness.env.DEPLOY_RUN_SYNC = 'true';
  const blockedSync = runDeploy(harness, 'staging');
  assert.notEqual(blockedSync.status, 0);
  assert.match(blockedSync.stderr, /not allowed for staging/);
  assert.equal(readEvents(harness).length, eventCount);
});

test('preflight rejects missing state and migration conflicts before upload', (t) => {
  const missingEnvironmentHarness = createHarness(t);
  const missingEnvironment = runDeploy(missingEnvironmentHarness, 'production');
  assert.notEqual(missingEnvironment.status, 0);
  assert.match(missingEnvironment.stderr, /Missing .*\.env/);
  assert.equal(readEvents(missingEnvironmentHarness).some((event) => event.command === 'rsync'), false);

  const conflictHarness = createHarness(t);
  writeEnvironment(path.join(conflictHarness.productionRoot, '.env'), 'production');
  writeEnvironment(path.join(conflictHarness.productionRoot, 'site', '.env'), 'production');
  fs.writeFileSync(path.join(conflictHarness.productionRoot, 'stale.txt'), 'active');

  const conflict = runDeploy(conflictHarness, 'production');
  assert.notEqual(conflict.status, 0);
  assert.match(conflict.stderr, /Migration conflict/);
  assert.equal(fs.readFileSync(path.join(conflictHarness.productionRoot, 'stale.txt'), 'utf8'), 'active');
  assert.equal(readEvents(conflictHarness).some((event) => event.command === 'rsync'), false);
});

test('PM2 start failure does not run health checks or save process state', (t) => {
  const harness = createHarness(t);
  writeEnvironment(path.join(harness.productionRoot, '.env'), 'production');
  seedPm2Process(harness, {
    name: 'jake-production', pid: 4300, cwd: harness.productionRoot, port: 3000
  });
  harness.env.FAKE_PM2_START_FAIL = 'true';

  const result = runDeploy(harness, 'production');
  assert.notEqual(result.status, 0);
  const events = readEvents(harness);
  assert.ok(events.some((event) => event.command === 'pm2' && event.args[0] === 'start'));
  assert.equal(events.some((event) => event.command === 'curl'), false);
  assert.equal(events.some((event) => event.command === 'pm2' && event.args[0] === 'save'), false);
});

test('health failure leaves PM2 state unsaved', (t) => {
  const harness = createHarness(t);
  writeEnvironment(path.join(harness.productionRoot, '.env'), 'production');
  harness.env.FAKE_HEALTH_FAIL = 'true';

  const result = runDeploy(harness, 'production');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /health check did not become ready/);
  const events = readEvents(harness);
  assert.equal(events.filter((event) => event.command === 'curl').length, 15);
  assert.equal(events.some((event) => event.command === 'pm2' && event.args[0] === 'save'), false);
});
