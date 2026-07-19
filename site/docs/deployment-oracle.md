# Oracle production deployment

Team JD production runs as a single PM2 process at `/var/www/teamjd` on `127.0.0.1:3000`. Preview is a separate deployment at `/var/www/teamjd-staging` on port `3002`; do not change it during production updates.

Cloudflare and cloudflared are managed separately and are intentionally not installed, configured, restarted, or inspected by this procedure. The production origin target is `http://127.0.0.1:3000`.

## Runtime contract

- Node.js 22 and npm lockfiles
- PM2 process: `jake-production`
- PM2 configuration: `ecosystem.config.cjs`
- Environment: `/var/www/teamjd/.env`, mode `600`
- Persistent state: `/var/www/teamjd/data`
- Production scheduled asset sync enabled; preview scheduled asset sync disabled
- One forked process; no watch or cluster mode

The production environment requires the variables documented by `.env.example`. Use `NODE_ENV=production`, `HOST=127.0.0.1`, `PORT=3000`, `PUBLIC_BASE_URL=https://team-jd.com.au`, and `DROPBOX_REDIRECT_URI=https://team-jd.com.au/auth/dropbox/callback`. Keep secrets out of Git.

## Safe update

Record the current revision and back up `.env`, `data`, the PM2 dump, and any server-local configuration before an update. From the production checkout:

```bash
git fetch --prune origin
git checkout --detach <tested-commit>
npm ci
npm ci --prefix client
npm test
npm test --prefix client
npm run build
pm2 restart ecosystem.config.cjs --only jake-production --update-env
pm2 save
curl -fsS http://127.0.0.1:3000/healthz
```

Do not use `git reset --hard`, `git clean`, or copy `node_modules` between machines. Do not deploy a dirty worktree.

## Routine operations

```bash
pm2 status
pm2 logs jake-production --lines 200 --nostream
pm2 restart jake-production --update-env
systemctl status pm2-ubuntu --no-pager
curl -fsS http://127.0.0.1:3000/healthz
```

## Asset scheduler

Keep `ASSET_AUTO_SYNC_ENABLED=false` while staging a new production process. After local health, R2, Dropbox, and dry-run checks pass, set production to `ASSET_AUTO_SYNC_ENABLED=true` and `ASSET_SYNC_ON_BOOT=false`, then restart with `--update-env`. Preview must remain `ASSET_AUTO_SYNC_ENABLED=false` so only production mutates Dropbox, R2, and manifests.

## Rollback

Check out the previously recorded production commit, reinstall from both lockfiles, rebuild, restart `jake-production`, and verify `/healthz`. Public routing rollback is performed separately by the Cloudflare administrator.
