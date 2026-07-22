#!/usr/bin/env bash
set -euo pipefail

DEPLOY_ENVIRONMENT="${1:-}"

case "${DEPLOY_ENVIRONMENT}" in
  production)
    readonly DEPLOY_PATH="/var/www/teamjd"
    readonly PM2_APP_NAME="jake-production"
    readonly EXPECTED_PORT="3000"
    ;;
  staging)
    readonly DEPLOY_PATH="/var/www/teamjd-staging"
    readonly PM2_APP_NAME="jake-staging"
    readonly EXPECTED_PORT="3002"
    ;;
  *)
    echo "Usage: $0 <production|staging>" >&2
    exit 2
    ;;
esac

: "${DEPLOY_USER:?Missing DEPLOY_USER}"
: "${DEPLOY_HOST:?Missing DEPLOY_HOST}"

if [[ "${DEPLOY_ENVIRONMENT}" == "staging" && "${DEPLOY_RUN_SYNC:-false}" == "true" ]]; then
  echo "DEPLOY_RUN_SYNC=true is not allowed for staging." >&2
  exit 2
fi

for local_command in npm rsync ssh; do
  if ! command -v "${local_command}" >/dev/null 2>&1; then
    echo "Missing local deployment dependency: ${local_command}" >&2
    exit 1
  fi
done

readonly DEPLOY_TARGET="${DEPLOY_USER}@${DEPLOY_HOST}"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SITE_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly INCOMING_PATH="${DEPLOY_PATH}/.deploy-incoming"

echo "Preparing Oracle ${DEPLOY_ENVIRONMENT} deploy to ${DEPLOY_TARGET}:${DEPLOY_PATH}"
echo "Local source: ${SITE_ROOT}/"
echo "PM2 process: ${PM2_APP_NAME}; expected app port: 127.0.0.1:${EXPECTED_PORT}"
echo "Asset sync after deploy: ${DEPLOY_RUN_SYNC:-false}"

echo "Building React client from ${SITE_ROOT}..."
(
  cd "${SITE_ROOT}"
  npm run build
)

if ! ssh "${DEPLOY_TARGET}" bash -s -- "${DEPLOY_ENVIRONMENT}" <<'REMOTE_PREPARE'
set -euo pipefail

deploy_environment="$1"
case "${deploy_environment}" in
  production)
    deploy_path="/var/www/teamjd"
    expected_port="3000"
    ;;
  staging)
    deploy_path="/var/www/teamjd-staging"
    expected_port="3002"
    ;;
  *)
    echo "Refusing unexpected deployment environment: ${deploy_environment}" >&2
    exit 1
    ;;
esac

incoming_path="${deploy_path}/.deploy-incoming"
legacy_path="${deploy_path}/site"

for remote_command in node npm pm2 rsync curl; do
  if ! command -v "${remote_command}" >/dev/null 2>&1; then
    echo "Missing remote deployment dependency: ${remote_command}" >&2
    exit 1
  fi
done

mkdir -p "${deploy_path}"
test -d "${deploy_path}"
test -w "${deploy_path}"

if [[ -L "${legacy_path}" ]]; then
  echo "Refusing to migrate symlinked legacy path: ${legacy_path}" >&2
  exit 1
fi

if [[ -d "${legacy_path}" ]]; then
  for relative_path in .env data public/assets/generated; do
    if [[ -e "${legacy_path}/${relative_path}" && -e "${deploy_path}/${relative_path}" ]]; then
      echo "Migration conflict: both legacy and flattened ${relative_path} paths exist." >&2
      exit 1
    fi
  done
fi

env_path="${deploy_path}/.env"
if [[ ! -f "${env_path}" && -f "${legacy_path}/.env" ]]; then
  env_path="${legacy_path}/.env"
fi

if [[ ! -f "${env_path}" ]]; then
  echo "Missing ${deploy_path}/.env (and no legacy ${legacy_path}/.env was found)." >&2
  exit 1
fi

rm -rf -- "${incoming_path}"
mkdir -p "${incoming_path}"
REMOTE_PREPARE
then
  cat >&2 <<EOF
Unable to prepare ${DEPLOY_TARGET}:${DEPLOY_PATH}.

Confirm the Oracle user owns the target and that its .env exists. The recommended
${DEPLOY_ENVIRONMENT} values are documented in deploy.md. For a new target, run once on Oracle:
  sudo mkdir -p ${DEPLOY_PATH}
  sudo chown ${DEPLOY_USER}:${DEPLOY_USER} ${DEPLOY_PATH}
EOF
  exit 1
fi

echo "Uploading site/ contents to the validated incoming directory..."

rsync -avzh --delete --progress \
  --exclude 'node_modules/' \
  --exclude '/.git/' \
  --exclude '/.env' \
  --exclude '/data/' \
  --exclude '/public/assets/generated/' \
  --exclude '/.agent/' \
  --exclude '/.claude/' \
  --exclude '/.codex/' \
  --exclude '/.idea/' \
  --exclude '/.vscode/' \
  --exclude '/deploy.md' \
  --exclude '/pi_deploy.md' \
  --exclude '.DS_Store' \
  --exclude 'npm-debug.log' \
  "${SITE_ROOT}/" "${DEPLOY_TARGET}:${INCOMING_PATH}/"

ssh "${DEPLOY_TARGET}" bash -s -- "${DEPLOY_ENVIRONMENT}" <<'REMOTE_PROMOTE'
set -euo pipefail

deploy_environment="$1"
case "${deploy_environment}" in
  production)
    deploy_path="/var/www/teamjd"
    pm2_app_name="jake-production"
    expected_port="3000"
    legacy_pm2_app_name=""
    ;;
  staging)
    deploy_path="/var/www/teamjd-staging"
    pm2_app_name="jake-staging"
    expected_port="3002"
    legacy_pm2_app_name="jake-site-staging"
    ;;
  *)
    echo "Refusing unexpected deployment environment: ${deploy_environment}" >&2
    exit 1
    ;;
esac

incoming_path="${deploy_path}/.deploy-incoming"
legacy_path="${deploy_path}/site"

cd "${incoming_path}"
npm ci --omit=dev

node - "${pm2_app_name}" "${expected_port}" "${deploy_environment}" <<'NODE_CONFIG'
const path = require('node:path');
const expectedName = process.argv[2];
const expectedPort = process.argv[3];
const environment = process.argv[4];
const config = require('./ecosystem.config.cjs');
const app = Array.isArray(config.apps) && config.apps.find((candidate) => candidate.name === expectedName);
if (!app) {
  throw new Error(`Missing PM2 ecosystem app: ${expectedName}`);
}
if (path.resolve(app.cwd || '') !== process.cwd()) {
  throw new Error(`PM2 ecosystem cwd for ${expectedName} must be __dirname`);
}
if (String(app.env?.NODE_ENV) !== 'production' || String(app.env?.HOST) !== '127.0.0.1') {
  throw new Error(`PM2 ecosystem security settings are invalid for ${expectedName}`);
}
if (String(app.env?.PORT) !== expectedPort) {
  throw new Error(`PM2 ecosystem port is invalid for ${expectedName}`);
}
if (environment === 'staging' && (
  String(app.env?.ASSET_AUTO_SYNC_ENABLED) !== 'false' ||
  String(app.env?.ASSET_SYNC_ON_BOOT) !== 'false'
)) {
  throw new Error('PM2 staging asset automation must be forced off');
}
NODE_CONFIG

if [[ -d "${legacy_path}" ]]; then
  for relative_path in .env data public/assets/generated; do
    if [[ -e "${legacy_path}/${relative_path}" && -e "${deploy_path}/${relative_path}" ]]; then
      echo "Migration conflict appeared during deploy for ${relative_path}; promotion stopped." >&2
      exit 1
    fi
  done

  if [[ -e "${legacy_path}/.env" ]]; then
    mv "${legacy_path}/.env" "${deploy_path}/.env"
  fi
  if [[ -e "${legacy_path}/data" ]]; then
    mv "${legacy_path}/data" "${deploy_path}/data"
  fi
  if [[ -e "${legacy_path}/public/assets/generated" ]]; then
    mkdir -p "${deploy_path}/public/assets"
    mv "${legacy_path}/public/assets/generated" "${deploy_path}/public/assets/generated"
  fi

  rm -rf -- "${legacy_path}"
fi

chmod 600 "${deploy_path}/.env"
mkdir -p "${deploy_path}/data"
chmod 700 "${deploy_path}/data"

if [[ "${deploy_environment}" == "staging" ]]; then
  production_manifest="/var/www/teamjd/data/asset-manifest.json"
  staging_manifest="${deploy_path}/data/asset-manifest.json"

  if [[ -f "${production_manifest}" ]]; then
    cp "${production_manifest}" "${staging_manifest}.tmp"
    chmod 600 "${staging_manifest}.tmp"
    mv "${staging_manifest}.tmp" "${staging_manifest}"
  fi
fi

rsync -a --delete \
  --exclude '/.deploy-incoming/' \
  --exclude '/.env' \
  --exclude '/data/' \
  --exclude '/public/assets/generated/' \
  "${incoming_path}/" "${deploy_path}/"

rm -rf -- "${incoming_path}"

cd "${deploy_path}"

read_pm2_pid() {
  local process_name="$1"
  local pid
  pid="$(pm2 pid "${process_name}" 2>/dev/null | tail -n 1 || true)"
  if [[ "${pid}" =~ ^[1-9][0-9]*$ ]]; then
    printf '%s' "${pid}"
  else
    printf '0'
  fi
}

verify_pm2_process() {
  local previous_pid="$1"
  local state_file
  state_file="$(mktemp)"
  pm2 jlist > "${state_file}"

  if ! node - "${state_file}" "${pm2_app_name}" "${deploy_path}" "${expected_port}" \
    "${previous_pid}" "${legacy_pm2_app_name}" <<'NODE_VERIFY'
const fs = require('node:fs');
const path = require('node:path');

const [stateFile, expectedName, expectedCwd, expectedPort, previousPidValue, legacyName] = process.argv.slice(2);
const processes = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
const matches = processes.filter((process) => process.name === expectedName);
if (matches.length !== 1) {
  throw new Error(`Expected exactly one ${expectedName} process; found ${matches.length}`);
}

const pm2Process = matches[0];
const environment = pm2Process.pm2_env || {};
if (environment.status !== 'online') {
  throw new Error(`${expectedName} is ${environment.status || 'missing a PM2 status'}, not online`);
}
if (!Number.isInteger(pm2Process.pid) || pm2Process.pid <= 0) {
  throw new Error(`${expectedName} does not have a live PID`);
}

const previousPid = Number(previousPidValue);
if (previousPid > 0 && pm2Process.pid === previousPid) {
  throw new Error(`${expectedName} retained its old PID ${previousPid}`);
}
const actualCwd = fs.realpathSync(path.resolve(environment.pm_cwd || ''));
const requiredCwd = fs.realpathSync(path.resolve(expectedCwd));
if (actualCwd !== requiredCwd) {
  throw new Error(`${expectedName} has cwd ${environment.pm_cwd || '<missing>'}; expected ${expectedCwd}`);
}
if (String(environment.PORT) !== expectedPort) {
  throw new Error(`${expectedName} has PORT=${environment.PORT || '<missing>'}; expected ${expectedPort}`);
}
if (String(environment.NODE_ENV) !== 'production') {
  throw new Error(`${expectedName} has NODE_ENV=${environment.NODE_ENV || '<missing>'}; expected production`);
}
if (legacyName && processes.some((candidate) => candidate.name === legacyName)) {
  throw new Error(`Legacy PM2 process ${legacyName} still exists`);
}
NODE_VERIFY
  then
    rm -f -- "${state_file}"
    return 1
  fi

  rm -f -- "${state_file}"
}

previous_pid="$(read_pm2_pid "${pm2_app_name}")"
legacy_pid="0"
if [[ -n "${legacy_pm2_app_name}" ]]; then
  legacy_pid="$(read_pm2_pid "${legacy_pm2_app_name}")"
fi

echo "Replacing PM2 process ${pm2_app_name} (previous PID: ${previous_pid})."
if [[ -n "${legacy_pm2_app_name}" && "${legacy_pid}" != "0" ]]; then
  echo "Removing legacy PM2 process ${legacy_pm2_app_name} (PID: ${legacy_pid})."
fi

pm2 delete "${pm2_app_name}" >/dev/null 2>&1 || true
if [[ -n "${legacy_pm2_app_name}" ]]; then
  pm2 delete "${legacy_pm2_app_name}" >/dev/null 2>&1 || true
fi
pm2 start ecosystem.config.cjs --only "${pm2_app_name}" --update-env
verify_pm2_process "${previous_pid}"

for attempt in {1..15}; do
  if curl -fsS "http://127.0.0.1:${expected_port}/healthz"; then
    printf '\n'
    verify_pm2_process "${previous_pid}"
    pm2 save
    break
  fi
  if [[ "${attempt}" == "15" ]]; then
    echo "${deploy_environment} health check did not become ready on port ${expected_port}." >&2
    exit 1
  fi
  sleep 2
done
REMOTE_PROMOTE

if [[ "${DEPLOY_RUN_SYNC:-false}" == "true" ]]; then
  ssh "${DEPLOY_TARGET}" bash -s -- "${DEPLOY_ENVIRONMENT}" <<'REMOTE_SYNC'
set -euo pipefail
case "$1" in
  production) deploy_path="/var/www/teamjd" ;;
  staging)
    echo "Deploy-time asset sync is not allowed for staging." >&2
    exit 1
    ;;
  *)
    echo "Refusing unexpected deployment environment: $1" >&2
    exit 1
    ;;
esac
cd "${deploy_path}"
npm run sync-assets
REMOTE_SYNC
else
  echo "Skipped deploy-time asset sync."
fi

echo "Oracle ${DEPLOY_ENVIRONMENT} deployment complete."
