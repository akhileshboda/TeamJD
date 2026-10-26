# Oracle production and staging deployment

Team JD production and staging are separate applications on the same Oracle Ubuntu host. Deployments transfer only the local `site/` project; Oracle does not keep a Git checkout or the rest of the repository. Cloudflare and cloudflared are managed separately and are not changed by these scripts.

## Runtime contract

| Environment | Application root | PM2 process | Origin | Asset automation |
| --- | --- | --- | --- | --- |
| Production | `/var/www/teamjd` | `jake-production` | `127.0.0.1:3000` | Enabled by production `.env` |
| Staging | `/var/www/teamjd-staging` | `jake-staging` | `127.0.0.1:3002` | Forced off |

Both applications use Node.js 22, npm lockfiles, one PM2 fork, `cwd: __dirname`, and no watch mode. The host and local development machine require rsync; Oracle additionally requires PM2 and curl. The checked-in `ops/pm2-ubuntu.service` resurrects the saved process list for the `ubuntu` user.

## One-time setup

Create writable application roots:

```bash
sudo mkdir -p /var/www/teamjd /var/www/teamjd-staging
sudo chown ubuntu:ubuntu /var/www/teamjd /var/www/teamjd-staging
```

Create separate environment files at `/var/www/teamjd/.env` and `/var/www/teamjd-staging/.env`, using all required values from `.env.example`. The deploy preflight requires these files but deliberately does not reject legacy values for settings enforced by the PM2 ecosystem file.

Production must include:

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
PUBLIC_BASE_URL=https://team-jd.com.au
DROPBOX_REDIRECT_URI=https://team-jd.com.au/auth/dropbox/callback
ASSET_AUTO_SYNC_ENABLED=true
ASSET_SYNC_ON_BOOT=false
DROPBOX_OAUTH_ENABLED=false
ENQUIRY_MAIL_PROVIDER=resend
RESEND_API_KEY=<production-sending-only-key>
ENQUIRY_EMAIL_FROM=Team JD Enquiries <enquiries@send.team-jd.com.au>
ENQUIRY_NOTIFICATION_TO=akhileshboda@outlook.com
ENQUIRY_REPLY_TO=akhileshboda@outlook.com
ENQUIRY_EMAIL_SUBJECT_PREFIX=
TURNSTILE_SITE_KEY=<production-hostname-restricted-site-key>
TURNSTILE_SECRET_KEY=<production-secret-key>
```

Staging must include its routed HTTPS hostname and these safety settings:

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=3002
PUBLIC_BASE_URL=https://<staging-domain>
DROPBOX_REDIRECT_URI=https://<staging-domain>/auth/dropbox/callback
ASSET_AUTO_SYNC_ENABLED=false
ASSET_SYNC_ON_BOOT=false
DROPBOX_OAUTH_ENABLED=false
ENQUIRY_MAIL_PROVIDER=resend
RESEND_API_KEY=<staging-sending-only-key>
ENQUIRY_EMAIL_FROM=Team JD Enquiries <enquiries@send.team-jd.com.au>
ENQUIRY_NOTIFICATION_TO=akhileshboda@outlook.com
ENQUIRY_REPLY_TO=akhileshboda@outlook.com
ENQUIRY_EMAIL_SUBJECT_PREFIX=[STAGING]
TURNSTILE_SITE_KEY=<staging-hostname-restricted-site-key>
TURNSTILE_SECRET_KEY=<staging-secret-key>
```

Keep `NODE_ENV=production` in staging so the file documents the effective runtime correctly. For safe recovery from older staging configurations, the PM2 staging entry overrides `NODE_ENV`, `HOST`, `PORT`, and both automatic-sync variables with the values in the runtime contract. Restrict each `.env` to mode `600`; the deploy scripts enforce that mode during promotion without rewriting its contents.

### Enquiry delivery setup

Verify `send.team-jd.com.au` in Resend using the exact SPF and DKIM records Resend supplies. Use separate sending-only API keys for staging and production, keep provider open/click tracking disabled, and restrict each Turnstile widget to its environment hostname. The application sends the internal notification and customer confirmation in one idempotent batch. Jake's later inbox cutover only changes `ENQUIRY_NOTIFICATION_TO` and `ENQUIRY_REPLY_TO`; Google Workspace SMTP is intentionally not implemented until authenticated access is available.

In the Cloudflare zone, add a rate-limiting rule for `http.request.uri.path eq "/api/enquiries"` at 5 requests per 10 seconds, using managed challenge or block according to observed traffic. Keep the application limits enabled: the edge rule is supplementary and may permit a small burst before enforcement.

Dropbox OAuth returns 404 in production-mode environments unless `DROPBOX_OAUTH_ENABLED=true`. Enable it only for a controlled re-authentication window, complete the flow, then disable it and restart the relevant PM2 process with `--update-env`.

The rate-limit stores are process-local by design because each environment runs one PM2 fork. Do not add PM2 forks or another application host until the stores are moved to a shared backend. The origin-wide daily ceiling limits this application to 40 accepted enquiries (80 messages), but Resend key protection and provider-side monitoring are still required because no application limit can contain a key used outside this origin.

### Dashboard setup

1. Add to each environment's `.env`, then restart with `--update-env`:

   ```env
   CMS_ADMIN_EMAILS=jake@team-jd.com.au,akboda00@gmail.com
   ```

   Sign-in codes are sent through the enquiry Resend settings (`ENQUIRY_MAIL_PROVIDER`, `RESEND_API_KEY`, `ENQUIRY_EMAIL_FROM`); no other setup is needed. Never set `CMS_DEV_BYPASS` on the VM (it is ignored in production anyway). If a Cloudflare Access application from the old media manager exists for `/admin`, delete it: the dashboard has its own sign-in page.
2. On the VM, install ffmpeg once. Video uploads report "Video processing is not available" until you do; photo uploads don't need it.

   ```bash
   sudo apt-get update && sudo apt-get install -y ffmpeg
   ffmpeg -version | head -1
   ```

3. Check it.
   - `curl -s -o /dev/null -w '%{http_code}' https://team-jd.com.au/api/admin/stats` returns `401`.
   - Signing in at `/admin` with an allowlisted address emails a code and opens the dashboard.
   - `curl -s https://team-jd.com.au/api/content/services | head -c 80` returns JSON (seeded on first start).
4. Back up and restore: `data/cms.json` is copied to Dropbox `/cms-backup/<environment>/cms.json` after each change. To restore, stop the app, copy that file to `data/cms.json`, start it again.

Library uploads live in R2 under `cms/<environment>/` (`R2_CMS_PREFIX`), outside the sync's `R2_ASSET_PREFIX`. Staging and production share the bucket and Dropbox account but use different folders. `data/cms.json` and `data/analytics/` are runtime state like `data/asset-manifest.json`: deploys keep them.

### Capacity alert setup

The production process samples host CPU, host RAM (`MemAvailable`), Node event-loop lag (p99) and Node memory (against the 300 MB PM2 cap) every 30 seconds. When any one stays above 80% in at least 8 of the last 10 samples (about 5 minutes) it emails `CAPACITY_ALERT_TO` through the enquiry Resend settings, at most once every 6 hours, then sends one recovery email after a calm window. That is the signal to scale the VM. The cooldown survives restarts (`data/capacity-alert-state.json`). Staging never runs it, because both environments share the host.

1. Add to the production `.env`, then restart with `--update-env`:

   ```env
   CAPACITY_ALERT_TO=you@example.com
   ```

   Optional tuning (defaults in `.env.example`): `CAPACITY_ALERT_THRESHOLD`, `CAPACITY_ALERT_COOLDOWN_HOURS`, `CAPACITY_EVENT_LOOP_MAX_MS`, `CAPACITY_RSS_LIMIT_MB`, `CAPACITY_MONITOR_ENABLED`. Keep `CAPACITY_RSS_LIMIT_MB` equal to `max_memory_restart` in `ecosystem.config.cjs`.
2. Check it after every deploy. From the app directory (`/var/www/teamjd`):

   ```bash
   npm run capacity:test -- --env production   # staging: /var/www/teamjd-staging, --env staging
   ```

   One `[TEST] Capacity report` email arrives with the live `/healthz` result, host and monitor readings, and PASS/FAIL lines. It still sends when the site is down (subject says `DOWN`) and exits non-zero only if the email could not be sent. It never touches the alert cooldown. `--env` supplies the `APP_ENV` and `PORT` that PM2 sets but an SSH shell does not (without it the command checks port 3000). Add `--env-file <path>` to use a different `.env`.
3. Limits: this process cannot email if the app or VM is completely down. Add a free external uptime check on `https://team-jd.com.au/healthz` for that.

## Deploy

Install and test locally before deployment:

```bash
cd /path/to/TeamJD/site
npm ci
npm ci --prefix client
npm test
npm test --prefix client
```

Deploy either target with its explicit command:

```bash
DEPLOY_USER=ubuntu DEPLOY_HOST=<oracle-host> npm run deploy:production
DEPLOY_USER=ubuntu DEPLOY_HOST=<oracle-host> npm run deploy:staging
```

The shared deploy engine performs local and remote dependency checks, requires the selected `.env`, builds the client locally, removes any abandoned `.deploy-incoming`, and uploads only `site/` into a fresh incoming directory. It runs `npm ci --omit=dev` and validates the selected PM2 entry there before changing the active application. Promotion preserves `.env`, `data/`, and `public/assets/generated/` while removing stale application files.

After promotion, deployment records the existing PID, deletes only the selected PM2 process, and starts its ecosystem entry fresh with `--only`. It verifies that PM2 reports a new online PID with the expected working directory, port, and `NODE_ENV=production`; then it waits for that environment's `/healthz` response and saves PM2 state. A start or health failure does not overwrite the previously saved startup list.

`DEPLOY_RUN_SYNC=true` is an explicit production-only post-health-check sync. Staging rejects it. On a shared host, staging copies only `/var/www/teamjd/data/asset-manifest.json` into its own data directory when the production manifest exists; sessions, logs, generated assets, and sync state stay isolated.

## Legacy migration

Either environment can flatten an older nested `site/` layout. Before promotion, the deploy moves legacy `.env`, `data/`, and `public/assets/generated/` into the selected application root. If a legacy path and its flattened destination both exist, deployment stops without deleting either copy.

The first successful staging promotion also removes the retired `jake-site-staging` PM2 entry before starting `jake-staging`. Production and staging scripts validate their fixed paths and never clean or restart the other environment.

## Routine operations

```bash
pm2 status
pm2 logs jake-production --lines 200 --nostream
pm2 logs jake-staging --lines 200 --nostream

cd /var/www/teamjd
pm2 restart ecosystem.config.cjs --only jake-production --update-env

cd /var/www/teamjd-staging
pm2 restart ecosystem.config.cjs --only jake-staging --update-env

pm2 save
systemctl status pm2-ubuntu --no-pager
curl -fsS http://127.0.0.1:3000/healthz
curl -fsS http://127.0.0.1:3002/healthz
```

## Rollback

On the development machine, check out the previously tested commit or tag, reinstall both lockfiles, rerun both test suites, and execute the deployment command for only the affected environment. Redeployment preserves that environment's `.env` and runtime state. Public routing rollback remains a separate Cloudflare operation.
