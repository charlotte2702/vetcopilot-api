// Local dev server.
// - Serves API routes (from lib/app.js)
// - Serves the untouched prototype directly from ~/vetcopilot-pwa/
//   so any edit there shows up without copying anything.
const path = require('path');
const express = require('express');
const app = require('./lib/app');

const PWA_DIR = path.resolve(__dirname, '..', 'vetcopilot-pwa');

app.use(express.static(PWA_DIR, { extensions: ['html'] }));

// SPA fallback: anything that isn't /api/* and isn't a real static file
// gets index.html (so deep links keep working).
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(PWA_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`VetCopilot API listening on http://localhost:${PORT}`);
  console.log(`Serving static prototype from ${PWA_DIR}`);
});
