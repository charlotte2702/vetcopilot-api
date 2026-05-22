// Headless-Chromium PDF generator.
//
// One code path, two execution profiles:
//   • LOCAL DEV: uses the user's system Chrome (no bundled Chromium needed)
//   • SERVERLESS (Vercel / AWS Lambda): uses @sparticuz/chromium-min, which
//     downloads a Linux-x64 Chromium binary from a public GitHub release into
//     /tmp on cold-start (~3 s once, then cached for warm invocations).
//
// Same Puppeteer API, same HTML templates, identical PDFs in both environments.

const puppeteer = require('puppeteer-core');
const fs = require('fs');

const isServerless = !!(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NETLIFY ||
  process.env.LAMBDA_TASK_ROOT
);

// chromium-min ships only configuration; the binary URL must match its version.
// Reading the installed version keeps these in sync after upgrades.
const SPARTICUZ_VERSION = (() => {
  try { return require('@sparticuz/chromium-min/package.json').version; }
  catch (_) { return null; }
})();
const CHROMIUM_PACK_URL = SPARTICUZ_VERSION
  ? `https://github.com/Sparticuz/chromium/releases/download/v${SPARTICUZ_VERSION}/chromium-v${SPARTICUZ_VERSION}-pack.x64.tar`
  : null;

let browserPromise = null;

function findLocalChrome() {
  // Allow explicit override — useful when Chrome is installed in a non-standard location.
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const candidates = [
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const p of candidates) {
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch (_) { /* not found */ }
  }
  return null;
}

async function getLaunchConfig() {
  if (isServerless) {
    if (!SPARTICUZ_VERSION) {
      throw new Error('@sparticuz/chromium-min introuvable — npm install requis');
    }
    const chromium = require('@sparticuz/chromium-min');
    return {
      args: [...chromium.args, '--disable-dev-shm-usage'],
      executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
      headless: true,
    };
  }
  // Local dev — use the system browser
  const exec = findLocalChrome();
  if (!exec) {
    throw new Error(
      "Aucun navigateur Chrome détecté en local. Installez Google Chrome OU définissez " +
      "PUPPETEER_EXECUTABLE_PATH dans .env (chemin absolu vers l'exécutable)."
    );
  }
  return {
    executablePath: exec,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const config = await getLaunchConfig();
      console.log(`[pdf] launching ${isServerless ? 'serverless Chromium' : 'system Chrome'}: ${config.executablePath}`);
      return puppeteer.launch(config);
    })().catch(err => {
      browserPromise = null; // allow retry
      throw err;
    });
  }
  return browserPromise;
}

/**
 * Render an HTML string to a PDF Buffer.
 */
async function htmlToPdf(html, opts = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.emulateMediaType('print');
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30_000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: !!(opts.headerTemplate || opts.footerTemplate),
      headerTemplate: opts.headerTemplate || '<span></span>',
      footerTemplate: opts.footerTemplate || '<span></span>',
      margin: opts.margin || { top: '14mm', right: '14mm', bottom: '20mm', left: '14mm' },
    });
    return pdf;
  } finally {
    await page.close().catch(() => {});
  }
}

async function closeBrowser() {
  if (browserPromise) {
    try {
      const b = await browserPromise;
      await b.close();
    } catch (_) { /* ignore */ }
    browserPromise = null;
  }
}

// In serverless environments we don't keep state between invocations; closing
// on signals helps only for the long-running local dev server.
if (!isServerless) {
  process.on('SIGTERM', closeBrowser);
  process.on('SIGINT', closeBrowser);
}

module.exports = { htmlToPdf, closeBrowser, isServerless };
