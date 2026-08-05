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
