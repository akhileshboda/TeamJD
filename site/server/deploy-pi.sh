#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_USER:?Missing DEPLOY_USER}"
: "${DEPLOY_HOST:?Missing DEPLOY_HOST}"
: "${DEPLOY_PATH:?Missing DEPLOY_PATH}"

DEPLOY_TARGET="${DEPLOY_USER}@${DEPLOY_HOST}"
REMOTE_DEPLOY_PATH="$(printf '%q' "${DEPLOY_PATH}")"

echo "Preparing ${DEPLOY_TARGET}:${DEPLOY_PATH}"
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

Create it on the Pi with production values before deploying.
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
  if npm run | grep -q 'sync-assets'; then npm run sync-assets; fi &&
  pm2 delete jake-site >/dev/null 2>&1 || true &&
  pm2 start npm --name jake-site -- start &&
  pm2 save
"

echo "Deployment complete."
