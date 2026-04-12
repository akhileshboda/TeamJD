const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const dotenv = require('dotenv');
const authRouter = require('./routes/auth');
const assetsRouter = require('./routes/assets');

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
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '127.0.0.1';
const publicDir = path.join(__dirname, '..', 'public');
const dataDir = path.join(__dirname, '..', 'data');

fs.mkdirSync(dataDir, { recursive: true });

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
app.use('/auth', authRouter);
app.use('/api/assets', assetsRouter);
app.use(express.static(publicDir));

app.use((req, res) => {
  res.status(404).send('Not found.');
});

app.listen(port, host, () => {
  console.log(`Team JD site running at http://${host}:${port}`);
});
