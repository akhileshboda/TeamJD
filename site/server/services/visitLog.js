const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, '..', '..', 'data', 'access.log');

// Fire-and-forget append of a single JSON line. Never throws into the request
// path — logging must not be able to take the site down.
function logVisit(entry) {
  const line = `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`;

  fs.appendFile(LOG_PATH, line, (error) => {
    if (error) {
      console.error('[visit-log] failed to write entry:', error.message);
    }
  });
}

module.exports = { logVisit, LOG_PATH };
