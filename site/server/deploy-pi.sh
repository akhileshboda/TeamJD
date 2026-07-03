#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_USER:?Missing DEPLOY_USER}"
: "${DEPLOY_HOST:?Missing DEPLOY_HOST}"

DEPLOY_ENV="${DEPLOY_ENV:-production}"

case "${DEPLOY_ENV}" in
  production)
    DEFAULT_DEPLOY_PATH="/var/www/teamjd"
    DEFAULT_PM2_APP_NAME="jake-site"
    EXPECTED_PORT="3000"
    ;;
  staging)
    DEFAULT_DEPLOY_PATH="/var/www/teamjd-staging"
    DEFAULT_PM2_APP_NAME="jake-site-staging"
    EXPECTED_PORT="3002"
    ;;
  *)
    cat >&2 <<EOF
Unsupported DEPLOY_ENV="${DEPLOY_ENV}".

Use one of:
  DEPLOY_ENV=production
  DEPLOY_ENV=staging
EOF
    exit 1
    ;;
esac

DEPLOY_PATH="${DEPLOY_PATH:-${DEFAULT_DEPLOY_PATH}}"
PM2_APP_NAME="${PM2_APP_NAME:-${DEFAULT_PM2_APP_NAME}}"

DEPLOY_TARGET="${DEPLOY_USER}@${DEPLOY_HOST}"
REMOTE_DEPLOY_PATH="$(printf '%q' "${DEPLOY_PATH}")"
REMOTE_PM2_APP_NAME="$(printf '%q' "${PM2_APP_NAME}")"

echo "Preparing ${DEPLOY_ENV} deploy to ${DEPLOY_TARGET}:${DEPLOY_PATH}"
echo "PM2 process: ${PM2_APP_NAME}; expected app port: localhost:${EXPECTED_PORT}"
echo "Asset sync after deploy: ${DEPLOY_RUN_SYNC:-false}"
if ! ssh "${DEPLOY_TARGET}" "
  mkdir -p ${REMOTE_DEPLOY_PATH} &&
  test -d ${REMOTE_DEPLOY_PATH} &&
  test -w ${REMOTE_DEPLOY_PATH}
"; then
  cat >&2 <<EOF
Unable to prepare ${DEPLOY_TARGET}:${DEPLOY_PATH}.

If this path should live under /var/www, run this once on the Pi:
  sudo mkdir -p ${DEPLOY_PATH}
  sudo chown ${DEPLOY_USER}:${DEPLOY_USER} ${DEPLOY_PATH}

Then re-run the deploy command.
EOF
  exit 1
fi
if ! ssh "${DEPLOY_TARGET}" "test -f ${REMOTE_DEPLOY_PATH}/.env"; then
  cat >&2 <<EOF
Missing ${DEPLOY_TARGET}:${DEPLOY_PATH}/.env.

Create it on the Pi before deploying. For ${DEPLOY_ENV}, it should include:
  NODE_ENV=production
  PORT=${EXPECTED_PORT}
  HOST=localhost
EOF
  exit 1
fi

echo "Building React client..."
npm run build

echo "Deploying to ${DEPLOY_TARGET}:${DEPLOY_PATH}"

rsync -avzh --delete --progress \
  --exclude node_modules \
  --exclude .git \
  --exclude .env \
  --exclude data \
  --exclude public/assets/generated \
  --exclude .DS_Store \
  --exclude npm-debug.log \
  ./ "${DEPLOY_TARGET}:${DEPLOY_PATH}/"

ssh "${DEPLOY_TARGET}" "
  set -e
  cd ${REMOTE_DEPLOY_PATH} &&
  npm install --omit=dev &&
  pm2 delete ${REMOTE_PM2_APP_NAME} >/dev/null 2>&1 || true &&
  pm2 start npm --name ${REMOTE_PM2_APP_NAME} -- start &&
  pm2 save
"

if [[ "${DEPLOY_RUN_SYNC:-false}" == "true" ]]; then
  ssh "${DEPLOY_TARGET}" "
    set -e
    cd ${REMOTE_DEPLOY_PATH} &&
    npm run sync-assets
  "
else
  cat <<EOF
Skipped automatic asset sync.

Express will run startup sync in the background only when ASSET_SYNC_ENABLED=true,
ASSET_AUTO_SYNC_ENABLED=true, and ASSET_SYNC_ON_BOOT=true in ${DEPLOY_PATH}/.env.
For staging, set ASSET_AUTO_SYNC_ENABLED=false to avoid background Dropbox/R2 usage.

To force a protected API sync on ${DEPLOY_ENV}, run the dry-run first:
  curl -H "Authorization: Bearer \$ASSET_SYNC_ADMIN_TOKEN" \\
    http://localhost:${EXPECTED_PORT}/api/assets/sync/plan

Then run the real sync:
  curl -X POST \\
    -H "Authorization: Bearer \$ASSET_SYNC_ADMIN_TOKEN" \\
    http://localhost:${EXPECTED_PORT}/api/assets/sync

Or SSH to the Pi and run this server-side command from ${DEPLOY_PATH}:
  npm run sync-assets

DEPLOY_RUN_SYNC=true remains an explicit one-off deployment sync if you intentionally
want to run it.
EOF
fi

echo "${DEPLOY_ENV} deployment complete."
