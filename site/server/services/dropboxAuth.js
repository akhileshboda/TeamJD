const { DropboxAuth } = require('dropbox');

function createDropboxAuth() {
  return new DropboxAuth({
    clientId: process.env.DROPBOX_APP_KEY,
    clientSecret: process.env.DROPBOX_APP_SECRET
  });
}

module.exports = { createDropboxAuth };
