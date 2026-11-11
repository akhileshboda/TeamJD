#!/usr/bin/env bash
# Runs the built site + dashboard in a local sandbox for UI audits.
#
#   bash tools/ui-audit/serve.sh            # build the client, then serve on :3100
#   SKIP_BUILD=1 bash tools/ui-audit/serve.sh
#
# Scratch data lives in data/ui-audit/ (gitignored). The paths are exported as
# real environment variables because server/app.js loads .env only after the
# content store and analytics modules have already read their paths.
set -euo pipefail
cd "$(dirname "$0")/../.."

SCRATCH="$(pwd)/data/ui-audit"
mkdir -p "$SCRATCH"

export NODE_ENV=development
export PORT="${UI_AUDIT_PORT:-3100}"
export HOST=localhost
export PUBLIC_BASE_URL="http://localhost:${PORT}"
export CMS_DEV_BYPASS=true
export CMS_DATA_PATH="$SCRATCH/cms.json"
export ANALYTICS_DATA_DIR="$SCRATCH/analytics"
export ASSET_SYNC_ENABLED=false
export ASSET_AUTO_SYNC_ENABLED=false
export ASSET_SYNC_ON_BOOT=false
export DROPBOX_OAUTH_ENABLED=false
export DROPBOX_REORGANIZE_ENABLED=false
export MAINTENANCE_MODE=false
export SITE_AUTH_ENABLED=false
# Blank storage credentials so nothing can reach R2 or Dropbox from the sandbox.
export R2_ACCOUNT_ID= R2_ACCESS_KEY_ID= R2_SECRET_ACCESS_KEY= DROPBOX_REFRESH_TOKEN= RESEND_API_KEY=
export DROPBOX_APP_KEY="${DROPBOX_APP_KEY:-ui-audit-placeholder}"
export DROPBOX_APP_SECRET="${DROPBOX_APP_SECRET:-ui-audit-placeholder}"
export DROPBOX_REDIRECT_URI="${DROPBOX_REDIRECT_URI:-http://localhost:${PORT}/auth/dropbox/callback}"
export SESSION_SECRET="${SESSION_SECRET:-ui-audit-$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")}"

if [ ! -d "$ANALYTICS_DATA_DIR" ] || [ -z "$(ls -A "$ANALYTICS_DATA_DIR" 2>/dev/null)" ]; then
  node tools/ui-audit/seed-analytics.js
fi

if [ -z "${SKIP_BUILD:-}" ]; then
  npm run build
fi

exec node server/app.js
