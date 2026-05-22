// Headless-Chromium PDF generator.
//
// Lazily launches a single Chromium instance and reuses it across requests.
// Each call opens a fresh page (cheap), sets the HTML, exports a PDF, then
// closes the page. The browser stays warm — first request pays the ~1.5s
// launch cost, subsequent ones are ~300ms.

const puppeteer = require('puppeteer');

let browserPromise = null;

function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    }).catch(err => {
      browserPromise = null; // allow retry on next call
      throw err;
    });
  }
  return browserPromise;
}

/**
 * Render an HTML string to a PDF Buffer.
 *
 * @param {string} html  Full HTML document (with <!DOCTYPE>, <head>, <body>)
 * @param {object} opts
 * @param {string} [opts.headerTemplate] HTML for the running header
 * @param {string} [opts.footerTemplate] HTML for the running footer
 * @param {object} [opts.margin] CSS-style margins (e.g. { top:'15mm', ... })
 * @returns {Promise<Buffer>}
 */
async function htmlToPdf(html, opts = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // Emulate screen colors (so backgrounds print) and a print-sized viewport.
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

// Gracefully close Chromium on server shutdown.
async function closeBrowser() {
  if (browserPromise) {
    try {
      const b = await browserPromise;
      await b.close();
    } catch (_) { /* ignore */ }
    browserPromise = null;
  }
}
process.on('SIGTERM', closeBrowser);
process.on('SIGINT', closeBrowser);

module.exports = { htmlToPdf, closeBrowser };
