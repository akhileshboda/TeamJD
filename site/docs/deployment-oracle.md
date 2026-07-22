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

Create separate environment files at `/var/www/teamjd/.env` and `/var/www/teamjd-staging/.env`, using all required values from `.env.example`.

Production must include:

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
PUBLIC_BASE_URL=https://team-jd.com.au
DROPBOX_REDIRECT_URI=https://team-jd.com.au/auth/dropbox/callback
ASSET_AUTO_SYNC_ENABLED=true
ASSET_SYNC_ON_BOOT=false
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
```

Use `NODE_ENV=production` in staging so secure cookies and production-safe response behavior remain enabled. The PM2 staging entry also forces both automatic-sync variables to `false`. Restrict each `.env` to mode `600`; the deploy scripts enforce that mode after validation.

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

The shared deploy engine performs local and remote dependency checks, validates the selected `.env`, builds the client locally, and uploads only `site/` into `.deploy-incoming`. It runs `npm ci --omit=dev` and validates the selected PM2 entry there before changing the active application. Promotion preserves `.env`, `data/`, and `public/assets/generated/`, removes stale files, restarts only the selected PM2 process, saves the process list, and waits for that environment's `/healthz` response.

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
