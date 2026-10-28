const path = require('node:path');

// --env-file <path> loads a specific .env (default: ./.env in this directory).
const flagIndex = process.argv.indexOf('--env-file');
require('dotenv').config(flagIndex > -1 ? { path: path.resolve(process.argv[flagIndex + 1]) } : undefined);

const { applyEnvFlag, runCapacityTest } = require('./services/capacityReport');

// --env staging|production fills in APP_ENV and PORT, which PM2 sets but a shell does not.
try {
  applyEnvFlag(process.argv);
} catch (error) {
  console.error(`[capacity-test] ${error.message}`);
  process.exit(1);
}

runCapacityTest()
  .then((result) => {
    console.log(`[capacity-test] ${result.subject}`);
    console.log(`[capacity-test] config: ${result.checks.config ? 'PASS' : 'FAIL'}, /healthz: ${result.checks.healthz ? 'PASS' : 'FAIL'}, monitor: ${result.checks.monitor === null ? 'not enabled here' : result.checks.monitor ? 'PASS' : 'FAIL'}`);
    if (!result.sent) {
      console.error(`[capacity-test] Email NOT sent: ${result.sendError}`);
      process.exit(1);
    }
    console.log('[capacity-test] Email accepted by Resend.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[capacity-test] Failed:', error.message);
    process.exit(1);
  });
