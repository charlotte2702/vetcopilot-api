// Vercel serverless entry point.
// Vercel auto-serves files placed in /public, so we only handle /api/*
// routes here via the shared Express app.
module.exports = require('../lib/app');
