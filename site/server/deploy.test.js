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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'teamjd-deploy-'));
  const binDir = path.join(tempRoot, 'bin');
  const callerDir = path.join(tempRoot, 'caller');
  const productionRoot = path.join(tempRoot, 'var', 'www', 'teamjd');
  const stagingRoot = path.join(tempRoot, 'var', 'www', 'teamjd-staging');
  const eventLog = path.join(tempRoot, 'events.jsonl');

  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(callerDir, { recursive: true });

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
const result = spawnSync('bash', ['-s', '--', ...args.slice(4).map(map)], {
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
if (args[0] === 'ci') {
  fs.mkdirSync(path.join(cwd, 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'node_modules', '.installed'), 'installed');
}
fs.appendFileSync(process.env.FAKE_EVENT_LOG, JSON.stringify({
  command: 'npm',
  cwd,
  args,
  activeStaleAtInstall: args[0] === 'ci' ? fs.existsSync(path.join(path.dirname(cwd), 'stale.txt')) : null
}) + '\\n');
`
  );

  for (const command of ['pm2', 'curl', 'sleep']) {
    writeExecutable(
      path.join(binDir, command),
      `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.FAKE_EVENT_LOG, JSON.stringify({
  command: ${JSON.stringify(command)},
  cwd: process.cwd(),
  args: process.argv.slice(2)
}) + '\\n');
if (${JSON.stringify(command)} === 'curl') process.stdout.write('{"status":"ok"}');
`
    );
  }

  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  return {
    callerDir,
    eventLog,
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
      FAKE_EVENT_LOG: eventLog
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

test('production validates incoming dependencies before migrating and promoting', (t) => {
  const harness = createHarness(t);
  const legacyRoot = path.join(harness.productionRoot, 'site');

  writeEnvironment(path.join(legacyRoot, '.env'), 'production');
  fs.mkdirSync(path.join(legacyRoot, 'data'), { recursive: true });
  fs.mkdirSync(path.join(legacyRoot, 'public', 'assets', 'generated'), { recursive: true });
  fs.writeFileSync(path.join(legacyRoot, 'data', 'state.json'), '{}');
  fs.writeFileSync(path.join(legacyRoot, 'public', 'assets', 'generated', 'asset.webp'), 'asset');
  fs.mkdirSync(path.join(harness.productionRoot, '.git'), { recursive: true });
  fs.writeFileSync(path.join(harness.productionRoot, 'stale.txt'), 'stale');

  const firstRun = runDeploy(harness, 'production');
  assert.equal(firstRun.status, 0, firstRun.stderr || firstRun.stdout);
  assert.equal(fs.existsSync(legacyRoot), false);
  assert.equal(fs.existsSync(path.join(harness.productionRoot, 'stale.txt')), false);
  assert.equal(fs.existsSync(path.join(harness.productionRoot, '.git')), false);
  assert.equal(fs.readFileSync(path.join(harness.productionRoot, 'data', 'state.json'), 'utf8'), '{}');
  assert.equal(
    fs.readFileSync(path.join(harness.productionRoot, 'public', 'assets', 'generated', 'asset.webp'), 'utf8'),
    'asset'
  );

  const events = readEvents(harness);
  const upload = events.find((event) => event.command === 'rsync' && event.kind === 'upload');
  const installIndex = events.findIndex((event) => event.command === 'npm' && event.args[0] === 'ci');
  const promoteIndex = events.findIndex((event) => event.command === 'rsync' && event.kind === 'promote');
  assert.ok(upload.args.includes(`${siteRoot}/`));
  assert.equal(upload.args.at(-1), 'tester@oracle.example:/var/www/teamjd/.deploy-incoming/');
  assert.ok(installIndex >= 0 && installIndex < promoteIndex);
  assert.equal(events[installIndex].activeStaleAtInstall, true);
  assert.ok(events.some((event) => event.command === 'pm2' && event.args.includes('jake-production')));
  assert.ok(events.some((event) => event.command === 'curl' && event.args.some((arg) => arg.includes(':3000/healthz'))));

  harness.env.DEPLOY_RUN_SYNC = 'true';
  const repeatRun = runDeploy(harness, 'production');
  assert.equal(repeatRun.status, 0, repeatRun.stderr || repeatRun.stdout);
  assert.ok(readEvents(harness).some(
    (event) => event.command === 'npm' && event.args.join(' ') === 'run sync-assets'
  ));
});

test('staging remains isolated, receives the production manifest, and cannot deploy-sync', (t) => {
  const harness = createHarness(t);
  const productionManifest = path.join(harness.productionRoot, 'data', 'asset-manifest.json');

  writeEnvironment(path.join(harness.productionRoot, '.env'), 'production');
  fs.mkdirSync(path.dirname(productionManifest), { recursive: true });
  fs.writeFileSync(productionManifest, '{"source":"production"}\n');
  fs.writeFileSync(path.join(harness.productionRoot, 'production-only'), 'keep');

  writeEnvironment(path.join(harness.stagingRoot, '.env'), 'staging');
  fs.mkdirSync(path.join(harness.stagingRoot, 'data'), { recursive: true });
  fs.mkdirSync(path.join(harness.stagingRoot, 'public', 'assets', 'generated'), { recursive: true });
  fs.writeFileSync(path.join(harness.stagingRoot, 'data', 'staging-only'), 'keep');
  fs.writeFileSync(path.join(harness.stagingRoot, 'public', 'assets', 'generated', 'stage.webp'), 'stage');
  fs.writeFileSync(path.join(harness.stagingRoot, 'stale.txt'), 'stale');

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
    (event) => event.command === 'pm2' && event.args[0] === 'delete' && event.args[1] === 'jake-site-staging'
  ));
  assert.ok(events.some((event) => event.command === 'pm2' && event.args.includes('jake-staging')));
  assert.ok(events.some((event) => event.command === 'curl' && event.args.some((arg) => arg.includes(':3002/healthz'))));

  const eventCount = events.length;
  harness.env.DEPLOY_RUN_SYNC = 'true';
  const blockedSync = runDeploy(harness, 'staging');
  assert.notEqual(blockedSync.status, 0);
  assert.match(blockedSync.stderr, /not allowed for staging/);
  assert.equal(readEvents(harness).length, eventCount);
});

test('preflight rejects state conflicts and unsafe staging sync settings', (t) => {
  const productionHarness = createHarness(t);
  writeEnvironment(path.join(productionHarness.productionRoot, '.env'), 'production');
  writeEnvironment(path.join(productionHarness.productionRoot, 'site', '.env'), 'production');
  fs.writeFileSync(path.join(productionHarness.productionRoot, 'stale.txt'), 'active');

  const conflict = runDeploy(productionHarness, 'production');
  assert.notEqual(conflict.status, 0);
  assert.match(conflict.stderr, /Migration conflict/);
  assert.equal(fs.readFileSync(path.join(productionHarness.productionRoot, 'stale.txt'), 'utf8'), 'active');
  assert.equal(readEvents(productionHarness).some((event) => event.command === 'rsync'), false);

  const stagingHarness = createHarness(t);
  writeEnvironment(path.join(stagingHarness.stagingRoot, '.env'), 'staging', {
    ASSET_AUTO_SYNC_ENABLED: 'true'
  });

  const unsafeStaging = runDeploy(stagingHarness, 'staging');
  assert.notEqual(unsafeStaging.status, 0);
  assert.match(unsafeStaging.stderr, /ASSET_AUTO_SYNC_ENABLED=false/);
  assert.equal(readEvents(stagingHarness).some((event) => event.command === 'rsync'), false);
});
