// Local dev server.
// - Serves API routes (from lib/app.js)
// - Serves the untouched prototype directly from ./public (source of truth).
require('dotenv').config();
const path = require('path');
const express = require('express');
const app = require('./lib/app');

const PUBLIC_DIR = path.resolve(__dirname, 'public');

app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// SPA fallback: anything that isn't /api/* and isn't a real static file
// gets index.html (so deep links keep working).
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`VetCopilot API listening on http://localhost:${PORT}`);
  console.log(`Serving static prototype from ${PUBLIC_DIR}`);
});
