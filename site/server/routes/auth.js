const crypto = require('crypto');
const express = require('express');
const { createDropboxAuth } = require('../services/dropboxAuth');

const router = express.Router();

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function getCallbackPayload(dropboxSession) {
  const basePayload = {
    connected: true,
    provider: 'dropbox',
    sessionStored: true,
    expiresIn: dropboxSession.expiresIn
  };

  if (isProduction()) {
    return {
      ...basePayload,
      hasAccessToken: Boolean(dropboxSession.accessToken),
      hasRefreshToken: Boolean(dropboxSession.refreshToken)
    };
  }

  return {
    ...basePayload,
    accessToken: dropboxSession.accessToken,
    refreshToken: dropboxSession.refreshToken
  };
}

router.get('/dropbox/start', async (req, res) => {
  try {
    const auth = createDropboxAuth();
    const state = crypto.randomBytes(32).toString('hex');

    req.session.oauth = {
      ...(req.session.oauth || {}),
      dropboxState: state
    };

    const url = await auth.getAuthenticationUrl(
      process.env.DROPBOX_REDIRECT_URI,
      state,
      'code',
      'offline',
      undefined,
      undefined,
      false
    );

    req.session.save((saveError) => {
      if (saveError) {
        return res.status(500).json({ error: 'Failed to start Dropbox OAuth' });
      }

      return res.redirect(url.toString());
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to start Dropbox OAuth' });
  }
});

router.get('/dropbox/callback', async (req, res) => {
  const { code, state } = req.query;
  const savedState = req.session.oauth?.dropboxState;

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  if (!state) {
    return res.status(400).json({ error: 'Missing OAuth state' });
  }

  if (!savedState || state.toString() !== savedState) {
    if (req.session.oauth) {
      delete req.session.oauth.dropboxState;
    }

    return req.session.save(() => {
      res.status(400).json({ error: 'Invalid OAuth state' });
    });
  }

  try {
    const auth = createDropboxAuth();
    const tokenResult = await auth.getAccessTokenFromCode(
      process.env.DROPBOX_REDIRECT_URI,
      code.toString()
    );

    const accessToken = tokenResult.result.access_token;
    const refreshToken = tokenResult.result.refresh_token;
    const expiresIn = tokenResult.result.expires_in;

    req.session.dropbox = {
      accessToken,
      refreshToken,
      expiresIn,
      obtainedAt: new Date().toISOString()
    };

    delete req.session.oauth.dropboxState;

    return req.session.save((saveError) => {
      if (saveError) {
        return res.status(500).json({ error: 'Failed to complete Dropbox OAuth' });
      }

      return res.json(getCallbackPayload(req.session.dropbox));
    });
  } catch (error) {
    delete req.session.oauth?.dropboxState;

    return req.session.save(() => {
      res.status(500).json({ error: 'Failed to complete Dropbox OAuth' });
    });
  }
});

module.exports = router;
