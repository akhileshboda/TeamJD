function normalizeDropboxUrl(sharedUrl) {
  if (!sharedUrl) {
    throw new Error('A Dropbox URL is required.');
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(sharedUrl);
  } catch (error) {
    throw new Error('Invalid Dropbox URL.');
  }

  if (!/dropbox\.com$/i.test(parsedUrl.hostname)) {
    throw new Error('Unsupported asset provider URL.');
  }

  parsedUrl.searchParams.delete('dl');
  parsedUrl.searchParams.set('raw', '1');

  return parsedUrl.toString();
}

module.exports = {
  normalizeDropboxUrl
};
