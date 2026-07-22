#!/usr/bin/env bash
set -euo pipefail

DEPLOY_ENVIRONMENT="${1:-}"

case "${DEPLOY_ENVIRONMENT}" in
  production)
    readonly DEPLOY_PATH="/var/www/teamjd"
    readonly PM2_APP_NAME="jake-production"
    readonly EXPECTED_PORT="3000"
    readonly LEGACY_PM2_APP_NAME=""
    ;;
  staging)
    readonly DEPLOY_PATH="/var/www/teamjd-staging"
    readonly PM2_APP_NAME="jake-staging"
    readonly EXPECTED_PORT="3002"
    readonly LEGACY_PM2_APP_NAME="jake-site-staging"
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

if ! ssh "${DEPLOY_TARGET}" bash -s -- \
  "${DEPLOY_ENVIRONMENT}" "${DEPLOY_PATH}" "${INCOMING_PATH}" "${EXPECTED_PORT}" <<'REMOTE_PREPARE'
set -euo pipefail

deploy_environment="$1"
deploy_path="$2"
incoming_path="$3"
expected_port="$4"
legacy_path="${deploy_path}/site"

case "${deploy_environment}:${deploy_path}:${expected_port}" in
  production:/var/www/teamjd:3000|staging:/var/www/teamjd-staging:3002) ;;
  *)
    echo "Refusing unexpected deployment target: ${deploy_environment}:${deploy_path}:${expected_port}" >&2
    exit 1
    ;;
esac

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

get_env_value() {
  local key="$1"
  local line
  local value

  line="$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "${env_path}" | tail -n 1 || true)"
  value="${line#*=}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"

  if [[ ${#value} -ge 2 ]]; then
    if [[ "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
      value="${value:1:${#value}-2}"
    fi
  fi

  printf '%s' "${value}"
}

require_env_value() {
  local key="$1"
  local expected="$2"
  local actual
  actual="$(get_env_value "${key}")"

  if [[ "${actual}" != "${expected}" ]]; then
    echo "${env_path} must set ${key}=${expected}; found ${actual:-<missing>}." >&2
    exit 1
  fi
}

require_env_value NODE_ENV production
require_env_value HOST 127.0.0.1
require_env_value PORT "${expected_port}"

if [[ "${deploy_environment}" == "staging" ]]; then
  require_env_value ASSET_AUTO_SYNC_ENABLED false
  require_env_value ASSET_SYNC_ON_BOOT false
fi

rm -rf -- "${incoming_path}"
mkdir -p "${incoming_path}"
REMOTE_PREPARE
then
  cat >&2 <<EOF
Unable to prepare ${DEPLOY_TARGET}:${DEPLOY_PATH}.

Confirm the Oracle user owns the target and that its .env matches the ${DEPLOY_ENVIRONMENT}
values documented in deploy.md. For a new target, run once on Oracle:
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

ssh "${DEPLOY_TARGET}" bash -s -- \
  "${DEPLOY_ENVIRONMENT}" "${DEPLOY_PATH}" "${INCOMING_PATH}" "${PM2_APP_NAME}" \
  "${EXPECTED_PORT}" "${LEGACY_PM2_APP_NAME}" <<'REMOTE_PROMOTE'
set -euo pipefail

deploy_environment="$1"
deploy_path="$2"
incoming_path="$3"
pm2_app_name="$4"
expected_port="$5"
legacy_pm2_app_name="$6"
legacy_path="${deploy_path}/site"

cd "${incoming_path}"
npm ci --omit=dev

node - "${pm2_app_name}" <<'NODE_CONFIG'
const expectedName = process.argv[2];
const config = require('./ecosystem.config.cjs');
if (!Array.isArray(config.apps) || !config.apps.some((app) => app.name === expectedName)) {
  throw new Error(`Missing PM2 ecosystem app: ${expectedName}`);
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
if [[ -n "${legacy_pm2_app_name}" ]]; then
  pm2 delete "${legacy_pm2_app_name}" >/dev/null 2>&1 || true
fi
pm2 startOrRestart ecosystem.config.cjs --only "${pm2_app_name}" --update-env
pm2 save

for attempt in {1..15}; do
  if curl -fsS "http://127.0.0.1:${expected_port}/healthz"; then
    printf '\n'
    exit 0
  fi
  sleep 2
done

echo "${deploy_environment} health check did not become ready on port ${expected_port}." >&2
exit 1
REMOTE_PROMOTE

if [[ "${DEPLOY_RUN_SYNC:-false}" == "true" ]]; then
  ssh "${DEPLOY_TARGET}" bash -s -- "${DEPLOY_PATH}" <<'REMOTE_SYNC'
set -euo pipefail
cd "$1"
npm run sync-assets
REMOTE_SYNC
else
  echo "Skipped deploy-time asset sync."
fi

echo "Oracle ${DEPLOY_ENVIRONMENT} deployment complete."
