/* Render the sanitized CV sources using local Chromium or Playwright Chromium.
 * PLAYWRIGHT_MODULE and BROWSER_PATH can point to tools outside the website.
 */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}) });
  try {
    for (const language of ['es', 'en']) {
      const page = await browser.newPage();
      await page.goto(pathToFileURL(path.resolve(__dirname, '../cv/' + language + '.html')).href);
      await page.pdf({ path: path.resolve(__dirname, '../assets/cv-sergio-ambrosio-' + language + '.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true, displayHeaderFooter: false });
      await page.close();
      console.log('Rendered public CV: ' + language);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
