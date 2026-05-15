#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_USER:?Missing DEPLOY_USER}"
: "${DEPLOY_HOST:?Missing DEPLOY_HOST}"
: "${DEPLOY_PATH:?Missing DEPLOY_PATH}"

echo "Deploying to ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}"

rsync -avz --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude .env \
  --exclude .DS_Store \
  --exclude npm-debug.log \
  ./ "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/"

ssh "${DEPLOY_USER}@${DEPLOY_HOST}" "
  cd '${DEPLOY_PATH}' &&
  npm install &&
  if npm run | grep -q 'sync-assets'; then npm run sync-assets; fi &&
  pm2 restart jake-site || pm2 start npm --name jake-site -- start &&
  pm2 save
"

echo "Deployment complete."