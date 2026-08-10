function sendStaticPage(res, { statusCode, filePath, fallbackMessage, cacheControl = 'no-cache' }) {
  res.status(statusCode);
  res.set('Cache-Control', cacheControl);
  return res.sendFile(filePath, (error) => {
    if (!error) return;
    if (!res.headersSent) {
      res.type('text/plain').status(statusCode).send(fallbackMessage);
    }
  });
}

module.exports = {
  sendStaticPage
};
