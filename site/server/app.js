const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const dotenv = require('dotenv');
const authRouter = require('./routes/auth');
const assetsRouter = require('./routes/assets');
const siteAuthRouter = require('./routes/siteAuth');
const { gateAssets, visitLogger } = require('./middleware/siteGate');
const { getAssetManifest, preloadAssetMap, runStartupAssetSync, startAssetPoller } = require('./services/dropbox');

dotenv.config();

const requiredAuthEnvVars = [
  'DROPBOX_APP_KEY',
  'DROPBOX_APP_SECRET',
  'DROPBOX_REDIRECT_URI',
  'SESSION_SECRET'
];

for (const envVar of requiredAuthEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required auth environment variable: ${envVar}`);
  }
}

const app = express();
// Trust the reverse proxy in front of the app (staging/prod HTTPS termination)
// so req.ip reflects the real client and secure cookies are sent.
app.set('trust proxy', 1);
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '127.0.0.1';
const listenHost = host === 'localhost' ? '127.0.0.1' : host;
const publicDir = path.join(__dirname, '..', 'public');
const dataDir = path.join(__dirname, '..', 'data');
const generatedAssetsDir = path.join(publicDir, 'assets', 'generated');

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(generatedAssetsDir, { recursive: true });

function getHtmlFilePath(requestPath) {
  let decodedPath;

  try {
    decodedPath = decodeURIComponent(requestPath.split('?')[0]);
  } catch (error) {
    return null;
  }

  const cleanPath = decodedPath.endsWith('/') ? `${decodedPath}index.html` : decodedPath;
  const htmlPath = path.extname(cleanPath) ? cleanPath : `${cleanPath}/index.html`;
  const resolvedPath = path.resolve(publicDir, `.${htmlPath}`);
  const relativePath = path.relative(publicDir, resolvedPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }

  return resolvedPath;
}

function shouldServeHtml(req) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    return false;
  }

  if (path.extname(req.path) && path.extname(req.path) !== '.html') {
    return false;
  }

  return req.accepts('html');
}

function rewriteAssetUrls(html, manifest) {
  return html.replace(
    /(?:https:\/\/jakededert\.fit)?\/api\/assets\/([a-z0-9-]+)/gi,
    (matchedUrl, assetKey) => {
      const localUrl = manifest.assets?.[assetKey]?.url;
      if (!localUrl) return matchedUrl;
      if (/^https?:\/\//i.test(localUrl)) return localUrl;
      // OG/Twitter meta tags use absolute URLs — preserve domain when the original was absolute
      if (matchedUrl.startsWith('https://')) {
        return new URL(localUrl, 'https://jakededert.fit').toString();
      }
      return localUrl;
    }
  );
}

async function serveManifestBackedHtml(req, res, next) {
  if (!shouldServeHtml(req)) {
    return next();
  }

  const htmlPath = getHtmlFilePath(req.path);

  if (!htmlPath) {
    return next();
  }

  try {
    const [html, manifest] = await Promise.all([
      fs.promises.readFile(htmlPath, 'utf8'),
      getAssetManifest()
    ]);
    const rewrittenHtml = rewriteAssetUrls(html, manifest);

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'no-cache');

    if (req.method === 'HEAD') {
      return res.end();
    }

    return res.send(rewrittenHtml);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return next();
    }

    console.error(`HTML asset rewrite failed for ${req.path}:`, error);
    return next();
  }
}

app.use(express.json());
app.use(
  session({
    store: new SQLiteStore({
      dir: './data',
      db: 'sessions.sqlite',
      table: 'sessions',
      createDirIfNotExists: true,
      concurrentDB: true
    }),
    name: 'teamjd.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);
app.use(visitLogger);
app.use('/auth', authRouter);
app.use('/api/auth', siteAuthRouter);
app.use('/api/assets', gateAssets, assetsRouter);
app.use(serveManifestBackedHtml);
app.use(
  '/assets/generated',
  express.static(generatedAssetsDir, {
    maxAge: 24 * 60 * 60 * 1000,
    etag: true,
    lastModified: true
  })
);
app.use(express.static(publicDir));

// Serve built React app (production)
const distDir = path.join(__dirname, '..', 'dist');
app.use(express.static(distDir));
app.get('*', (req, res, next) => {
  const distIndex = path.join(distDir, 'index.html');
  if (!fs.existsSync(distIndex)) return next();
  res.sendFile(distIndex);
});

app.use((req, res) => {
  res.status(404).send('Not found.');
});

async function startServer() {
  await preloadAssetMap();

  await new Promise((resolve, reject) => {
    const server = app.listen(port, listenHost);

    server.once('listening', () => {
      console.log(`Team JD site running at http://${host}:${port}`);
      resolve();
    });
    server.once('error', reject);
  });

  startAssetPoller();
  setImmediate(() => {
    runStartupAssetSync().catch((error) => {
      console.error('Failed to run startup asset sync:', error);
    });
  });
}

startServer().catch((error) => {
  console.error('Failed to start Team JD site:', error);
  process.exit(1);
});
