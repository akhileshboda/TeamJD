#!/usr/bin/env bash
set -euo pipefail

DEPLOY_ENVIRONMENT="${1:-}"

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SITE_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

# Host-specific values (paths, PM2 names, ports) live in the git-ignored
# deploy.env, not in this public script. Variables already set in the
# environment win over the file. See deploy.env.example.
DEPLOY_CONFIG_FILE="${DEPLOY_CONFIG_FILE:-${SITE_ROOT}/deploy.env}"
if [[ -f "${DEPLOY_CONFIG_FILE}" ]]; then
  while IFS= read -r config_line || [[ -n "${config_line}" ]]; do
    [[ "${config_line}" =~ ^[[:space:]]*(#|$) ]] && continue
    if [[ ! "${config_line}" =~ ^([A-Z][A-Z0-9_]*)=(.*)$ ]]; then
      echo "Ignoring malformed line in ${DEPLOY_CONFIG_FILE}" >&2
      continue
    fi
    config_key="${BASH_REMATCH[1]}"
    config_value="${BASH_REMATCH[2]}"
    config_value="${config_value%\"}"; config_value="${config_value#\"}"
    if [[ -z "${!config_key+x}" ]]; then
      export "${config_key}=${config_value}"
    fi
  done < "${DEPLOY_CONFIG_FILE}"
fi

case "${DEPLOY_ENVIRONMENT}" in
  production|staging) ;;
  *)
    echo "Usage: $0 <production|staging>" >&2
    exit 2
    ;;
esac

: "${DEPLOY_USER:?Missing DEPLOY_USER (see deploy.env.example)}"
: "${DEPLOY_HOST:?Missing DEPLOY_HOST (see deploy.env.example)}"
: "${TEAMJD_PRODUCTION_PATH:?Missing TEAMJD_PRODUCTION_PATH (see deploy.env.example)}"
: "${TEAMJD_STAGING_PATH:?Missing TEAMJD_STAGING_PATH (see deploy.env.example)}"
: "${TEAMJD_PRODUCTION_PM2_NAME:?Missing TEAMJD_PRODUCTION_PM2_NAME (see deploy.env.example)}"
: "${TEAMJD_STAGING_PM2_NAME:?Missing TEAMJD_STAGING_PM2_NAME (see deploy.env.example)}"
: "${TEAMJD_PRODUCTION_PORT:?Missing TEAMJD_PRODUCTION_PORT (see deploy.env.example)}"
: "${TEAMJD_STAGING_PORT:?Missing TEAMJD_STAGING_PORT (see deploy.env.example)}"

if [[ "${DEPLOY_ENVIRONMENT}" == "production" ]]; then
  readonly DEPLOY_PATH="${TEAMJD_PRODUCTION_PATH}"
  readonly PM2_APP_NAME="${TEAMJD_PRODUCTION_PM2_NAME}"
  readonly EXPECTED_PORT="${TEAMJD_PRODUCTION_PORT}"
  readonly LEGACY_PM2_APP_NAME="-"
else
  readonly DEPLOY_PATH="${TEAMJD_STAGING_PATH}"
  readonly PM2_APP_NAME="${TEAMJD_STAGING_PM2_NAME}"
  readonly EXPECTED_PORT="${TEAMJD_STAGING_PORT}"
  readonly LEGACY_PM2_APP_NAME="${TEAMJD_STAGING_LEGACY_PM2_NAME:--}"
fi
readonly PRODUCTION_PATH="${TEAMJD_PRODUCTION_PATH}"

# Validate locally so nothing odd reaches the remote shell. Every remote argument
# must be non-empty: ssh flattens argv into one string and drops empty entries.
validate_path() {
  if [[ ! "$2" =~ ^/[A-Za-z0-9._/-]+$ || "$2" == *..* || "$2" == "/" ]]; then
    echo "Invalid $1: must be an absolute path of letters, digits, '.', '_', '-' and '/'." >&2
    exit 2
  fi
}
validate_name() {
  if [[ ! "$2" =~ ^[A-Za-z0-9._-]+$ ]]; then
    echo "Invalid $1: use letters, digits, '.', '_' or '-'." >&2
    exit 2
  fi
}
validate_port() {
  if [[ ! "$2" =~ ^[1-9][0-9]{0,4}$ ]] || (( $2 > 65535 )); then
    echo "Invalid $1: must be a TCP port number." >&2
    exit 2
  fi
}
validate_path "deploy path" "${DEPLOY_PATH}"
validate_path "production path" "${PRODUCTION_PATH}"
validate_name "PM2 app name" "${PM2_APP_NAME}"
validate_name "legacy PM2 app name" "${LEGACY_PM2_APP_NAME}"
validate_port "app port" "${EXPECTED_PORT}"
if [[ "${DEPLOY_ENVIRONMENT}" == "staging" && "${DEPLOY_PATH}" == "${PRODUCTION_PATH}" ]]; then
  echo "Staging and production deploy paths must differ." >&2
  exit 2
fi

readonly REMOTE_ARGS=("${DEPLOY_ENVIRONMENT}" "${DEPLOY_PATH}" "${EXPECTED_PORT}" "${PM2_APP_NAME}" "${LEGACY_PM2_APP_NAME}" "${PRODUCTION_PATH}")

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
readonly INCOMING_PATH="${DEPLOY_PATH}/.deploy-incoming"

echo "Preparing ${DEPLOY_ENVIRONMENT} deploy to ${DEPLOY_TARGET}:${DEPLOY_PATH}"
echo "Local source: ${SITE_ROOT}/"
echo "PM2 process: ${PM2_APP_NAME}; expected app port: 127.0.0.1:${EXPECTED_PORT}"
echo "Asset sync after deploy: ${DEPLOY_RUN_SYNC:-false}"

echo "Building React client from ${SITE_ROOT}..."
(
  cd "${SITE_ROOT}"
  npm run build
)

if ! ssh "${DEPLOY_TARGET}" bash -s -- "${REMOTE_ARGS[@]}" <<'REMOTE_PREPARE'
set -euo pipefail

deploy_environment="$1"
deploy_path="$2"
expected_port="$3"
pm2_app_name="$4"
legacy_pm2_app_name="$5"
production_path="$6"
if [[ "$#" -ne 6 ]]; then
  echo "Refusing deploy: expected 6 arguments, got $#." >&2
  exit 1
fi
case "${deploy_environment}" in
  production|staging) ;;
  *)
    echo "Refusing unexpected deployment environment: ${deploy_environment}" >&2
    exit 1
    ;;
esac
for remote_path in "${deploy_path}" "${production_path}"; do
  if [[ ! "${remote_path}" =~ ^/[A-Za-z0-9._/-]+$ || "${remote_path}" == *..* ]]; then
    echo "Refusing unexpected deploy path." >&2
    exit 1
  fi
done
if [[ ! "${expected_port}" =~ ^[1-9][0-9]{0,4}$ || ! "${pm2_app_name}" =~ ^[A-Za-z0-9._-]+$ || ! "${legacy_pm2_app_name}" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "Refusing unexpected PM2 name or port." >&2
  exit 1
fi
if [[ "${legacy_pm2_app_name}" == "-" ]]; then
  legacy_pm2_app_name=""
fi

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

Confirm the deploy user owns the target and that its .env exists. For a new
target, run once on the server:
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
  --exclude '/deploy.env' \
  --exclude '.DS_Store' \
  --exclude 'npm-debug.log' \
  "${SITE_ROOT}/" "${DEPLOY_TARGET}:${INCOMING_PATH}/"

ssh "${DEPLOY_TARGET}" bash -s -- "${REMOTE_ARGS[@]}" <<'REMOTE_PROMOTE'
set -euo pipefail

deploy_environment="$1"
deploy_path="$2"
expected_port="$3"
pm2_app_name="$4"
legacy_pm2_app_name="$5"
production_path="$6"
if [[ "$#" -ne 6 ]]; then
  echo "Refusing deploy: expected 6 arguments, got $#." >&2
  exit 1
fi
case "${deploy_environment}" in
  production|staging) ;;
  *)
    echo "Refusing unexpected deployment environment: ${deploy_environment}" >&2
    exit 1
    ;;
esac
for remote_path in "${deploy_path}" "${production_path}"; do
  if [[ ! "${remote_path}" =~ ^/[A-Za-z0-9._/-]+$ || "${remote_path}" == *..* ]]; then
    echo "Refusing unexpected deploy path." >&2
    exit 1
  fi
done
if [[ ! "${expected_port}" =~ ^[1-9][0-9]{0,4}$ || ! "${pm2_app_name}" =~ ^[A-Za-z0-9._-]+$ || ! "${legacy_pm2_app_name}" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "Refusing unexpected PM2 name or port." >&2
  exit 1
fi
if [[ "${legacy_pm2_app_name}" == "-" ]]; then
  legacy_pm2_app_name=""
fi

incoming_path="${deploy_path}/.deploy-incoming"
legacy_path="${deploy_path}/site"

cd "${incoming_path}"
npm ci --omit=dev

if [[ "${deploy_environment}" == "production" ]]; then
  export TEAMJD_PRODUCTION_PM2_NAME="${pm2_app_name}" TEAMJD_PRODUCTION_PORT="${expected_port}"
else
  export TEAMJD_STAGING_PM2_NAME="${pm2_app_name}" TEAMJD_STAGING_PORT="${expected_port}"
fi

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
  production_manifest="${production_path}/data/asset-manifest.json"
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
  ssh "${DEPLOY_TARGET}" bash -s -- "${REMOTE_ARGS[@]}" <<'REMOTE_SYNC'
set -euo pipefail
if [[ "$1" != "production" ]]; then
  echo "Deploy-time asset sync is only allowed for production." >&2
  exit 1
fi
deploy_path="$2"
if [[ ! "${deploy_path}" =~ ^/[A-Za-z0-9._/-]+$ || "${deploy_path}" == *..* ]]; then
  echo "Refusing unexpected deploy path." >&2
  exit 1
fi
cd "${deploy_path}"
npm run sync-assets
REMOTE_SYNC
else
  echo "Skipped deploy-time asset sync."
fi

echo "${DEPLOY_ENVIRONMENT} deployment complete."
