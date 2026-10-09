/**
 * Rendered editorial readability, reflow and REAL browser zoom.
 * PLAYWRIGHT_MODULE / BROWSER_PATH / QA_SCREENSHOTS match browser.test.cjs.
 * READABILITY_ROUTES (comma separated) limits diagnosis to named HTML routes.
 * READABILITY_MODE=layout|zoom limits diagnosis; CI runs both by default.
 * READABILITY_WIDTHS / READABILITY_ZOOMS are comma-separated diagnostic subsets.
 *
 * Zoom uses a fresh persistent Chromium profile and the browser's own default
 * zoom setting through chrome://settings. Full Chromium (channel: chromium) is
 * required, not chromium-headless-shell. It verifies unchanged outer dimensions,
 * reduced CSS viewport, increased devicePixelRatio and visualViewport.scale=1.
 * Neither deviceScaleFactor nor Emulation.setPageScaleFactor is used. If native
 * zoom is unavailable this test fails explicitly; it never relabels pinch/DPR
 * emulation or a CSS transform as browser zoom.
 *
 * Font thresholds are this portfolio's editorial goals, not WCAG font minima.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = process.env.QA_SCREENSHOTS ? path.join(path.resolve(process.env.QA_SCREENSHOTS), 'readability') : fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-readability-'));
function htmlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || ['templates', 'node_modules', '__pycache__'].includes(entry.name)) return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(file) : file.endsWith('.html') ? [path.relative(root, file).split(path.sep).join('/')] : [];
  });
}
const routes = process.env.READABILITY_ROUTES ? process.env.READABILITY_ROUTES.split(',') : htmlFiles(root).sort();
const widths = process.env.READABILITY_WIDTHS ? process.env.READABILITY_WIDTHS.split(',').map(Number) : [320, 390, 768, 1366, 1440, 1920];
const zoomFactors = process.env.READABILITY_ZOOMS ? process.env.READABILITY_ZOOMS.split(',').map(Number) : [1.25, 1.5, 2];
const failures = [], observations = [], zoomEvidence = [];
let keyboardRegions = 0;
let keyboardTabEntries = 0;
const check = (condition, message) => { if (!condition) { failures.push(message); console.error('FAIL: ' + message); } };
const server = http.createServer((request, response) => {
  try {
    let file = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
  } catch { response.writeHead(400).end(); }
});
async function settle(page) {
  await page.evaluate(async () => {
    // Include information disclosed on demand, not only the compact initial view.
    document.querySelectorAll('details').forEach(node => { node.open = true; });
    document.querySelectorAll('img').forEach(node => { node.loading = 'eager'; });
    await Promise.all([...document.images].map(node => node.decode().catch(() => {})));
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
async function inspect(page, label) {
  const result = await page.evaluate(() => {
    const visible = node => {
      const box = node.getBoundingClientRect(), css = getComputedStyle(node);
      return box.width > 1 && box.height > 1 && css.visibility !== 'hidden' && css.display !== 'none' && !node.closest('[hidden], .sr-only, .skip-link');
    };
    const identify = node => node.id ? '#' + node.id : node.tagName.toLowerCase() + (node.className && typeof node.className === 'string' ? '.' + node.className.trim().replace(/\s+/g, '.') : '') + ': ' + node.textContent.trim().slice(0, 70);
    const mobile = innerWidth < 1024;
    const bodySelector = '.article-body>section:not(.reference-section)>p,.article>section>p,.selected-project-copy p,.section-heading>p,.expertise-grid p,.insight-list p,.demo-documentation p:not(.demo-origin),.code-applications>p:not(.code-scope),.code-case>header p,.automation-demo>p';
    const groups = [
      { name: 'body', selector: bodySelector, minimum: mobile ? 16 : 17, lineMinimum: 1.5 },
      { name: 'experience', selector: '.career-list p,.career-list ul li,.career-list strong', minimum: 16 },
      { name: 'about', selector: '.about-layout p:not(.education-note p)', minimum: 18, lineMinimum: 1.5 },
      { name: 'introductions', selector: '.hero-lead,.article-deck,.article-intro,.head>.wrap>p', minimum: mobile ? 18 : 19 },
      { name: 'navigation-controls', selector: 'nav a,button:not(#dialog-close),.button,.text-link,.demo-top-links a,.header-actions a,input[type=number],select', minimum: 15 },
      { name: 'captions-metadata', selector: 'figcaption,.article-facts dt,.article-facts dd,.career-date,.input-help,.chart-legend li,.code-record dt,.code-record dd', minimum: 13 },
    ];
    if (location.pathname.startsWith('/cv/')) groups.push({ name: 'public-cv-screen', selector: 'main p:not(.kicker),main li', minimum: mobile ? 16 : 17, lineMinimum: 1.5 });
    const sizes = [], smallText = [], tightLines = [], longLines = [];
    const smallControls = [...document.querySelectorAll('button,select,input[type=number],summary')].filter(visible).flatMap(node => {
      const box = node.getBoundingClientRect();
      return box.width < 23.5 || box.height < 23.5 ? [{ node: identify(node), width: box.width, height: box.height }] : [];
    });
    for (const group of groups) {
      const nodes = [...document.querySelectorAll(group.selector)].filter(visible);
      const fonts = nodes.map(node => parseFloat(getComputedStyle(node).fontSize));
      sizes.push({ group: group.name, count: nodes.length, minimum: fonts.length ? Math.min(...fonts) : null, maximum: fonts.length ? Math.max(...fonts) : null, goal: group.minimum });
      for (const node of nodes) {
        const css = getComputedStyle(node), size = parseFloat(css.fontSize), line = parseFloat(css.lineHeight) / size;
        if (size < group.minimum - .05) smallText.push({ group: group.name, node: identify(node), size, minimum: group.minimum });
        if (group.lineMinimum && node.tagName === 'P' && node.textContent.trim().length > 80 && line < group.lineMinimum - .01) tightLines.push({ node: identify(node), line });
        if (group.name === 'body' && node.textContent.trim().length > 150) {
          const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
          context.font = css.font;
          const text = node.textContent.trim(), average = context.measureText(text).width / text.length;
          const estimatedCharacters = node.clientWidth / average;
          if (estimatedCharacters > 95) longLines.push({ node: identify(node), estimatedCharacters: Math.round(estimatedCharacters) });
        }
      }
    }
    const clipping = [];
    for (const node of document.querySelectorAll('p,li,h1,h2,h3,h4,a,button,label,summary,span,dd,dt,td,th,code')) {
      if (!visible(node) || node.closest('svg,.hero-model,.model-topline') || ![...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim().length > 1)) continue;
      if (node.closest('.project-visual,.demo-preview,.insight-image')) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      const text = range.getBoundingClientRect();
      for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
        const css = getComputedStyle(ancestor), box = ancestor.getBoundingClientRect();
        const clippedX = /hidden|clip/.test(css.overflowX) && (text.left < box.left - 2 || text.right > box.right + 2);
        const clippedY = /hidden|clip/.test(css.overflowY) && (text.top < box.top - 2 || text.bottom > box.bottom + 2);
        if (clippedX || clippedY) { clipping.push({ node: identify(node), ancestor: identify(ancestor), axis: clippedX ? 'x' : 'y' }); break; }
        // Intentional scroll regions preserve access: validate their keyboard path separately.
        if (/auto|scroll/.test(css.overflowX + css.overflowY)) break;
      }
    }
    let scrollIndex = 0;
    for (const node of document.querySelectorAll('main *')) {
      if (!(node instanceof HTMLElement) || !visible(node) || ['INPUT','TEXTAREA','SELECT'].includes(node.tagName)) continue;
      const css = getComputedStyle(node);
      if (/auto|scroll/.test(css.overflowX) && node.scrollWidth > node.clientWidth + 2) node.dataset.readabilityScroll = String(scrollIndex++);
    }
    return { viewport: innerWidth, dpr: devicePixelRatio, overflow: document.documentElement.scrollWidth > innerWidth + 1, sizes, smallText, tightLines, longLines, smallControls, clipping, scrollRegions: scrollIndex,
      brokenImages: [...document.images].filter(node => !node.complete || !node.naturalWidth).map(node => node.getAttribute('src')) };
  });
  observations.push({ label, ...result });
  check(!result.overflow, label + ': horizontal page overflow');
  check(!result.brokenImages.length, label + ': broken images ' + result.brokenImages.join(', '));
  for (const item of result.smallText) check(false, label + ': ' + item.group + ' ' + item.size + 'px < ' + item.minimum + 'px; ' + item.node);
  for (const item of result.tightLines) check(false, label + ': paragraph line-height below 1.5; ' + item.node);
  for (const item of result.smallControls) check(false, label + ': control target below 24 CSS px; ' + item.node);
  for (const item of result.clipping) check(false, label + ': text clipped on ' + item.axis + '; ' + item.node + ' by ' + item.ancestor);
  for (let index = 0; index < result.scrollRegions; index++) {
    const region = page.locator('[data-readability-scroll="' + index + '"]');
    // Start immediately before the region and enter using the real Tab sequence.
    // Calling focus() alone would also accept a tabindex=-1 region that cannot
    // be reached by keyboard navigation.
    await region.evaluate(node => {
      node.scrollLeft = 0;
      const entry = document.createElement('button');
      entry.dataset.readabilityEntry = '';
      entry.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0';
      node.before(entry); entry.focus({ preventScroll: true });
    });
    await page.keyboard.press('Tab');
    const focused = await region.evaluate(node => node === document.activeElement);
    await page.locator('[data-readability-entry]').evaluate(node => node.remove());
    check(focused, label + ': horizontal content cannot be reached with Tab (' + index + ')');
    if (focused) {
      keyboardTabEntries++;
      await page.keyboard.press('ArrowRight');
      try { await page.waitForFunction(node => node.scrollLeft > 0, await region.elementHandle(), { timeout: 1500 }); keyboardRegions++; }
      catch { check(false, label + ': ArrowRight cannot reveal horizontal content (' + index + ')'); }
      await region.evaluate(node => { node.scrollLeft = 0; });
    }
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  return result;
}
function watch(page, label) {
  page.on('pageerror', error => check(false, label + ': JS ' + error.message));
  page.on('response', response => { if (response.status() >= 400) check(false, label + ': HTTP ' + response.status() + ' ' + response.url()); });
}
function fileLabel(route) { return route.replace(/\.html$/, '').replaceAll('/', '-'); }
const zoomCapture = route => route === 'index.html' || route === 'en/index.html' || /(?:sunsetgolf|pilares-cfrp|resultados-por-nivel|normativa\/index|cv\/)/.test(route);
async function main() {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const executable = process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {};
  let completed = false;
  try {
    if (process.env.READABILITY_MODE !== 'zoom') {
      const browser = await chromium.launch({ headless: true, ...executable });
      try {
        for (const width of widths) {
          const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 1000 }, reducedMotion: 'reduce' });
          const page = await context.newPage(); watch(page, width + 'px');
          for (const route of routes) {
            await page.goto(origin + '/' + route); await settle(page);
            const label = width + '-' + fileLabel(route), before = failures.length;
            await inspect(page, label);
            if ([390,1440].includes(width) || failures.length > before) await page.screenshot({ path: path.join(output, label + '.png'), animations: 'disabled' });
          }
          await context.close(); console.log('Readability/reflow checked: ' + routes.length + ' pages at ' + width + ' CSS px');
        }
      } finally { await browser.close(); }
    }
    if (process.env.READABILITY_MODE !== 'layout') {
      // Empty profile path creates a disposable profile, never the user's browser profile.
      const context = await chromium.launchPersistentContext('', { headless: true, channel: 'chromium', ...executable, viewport: null, reducedMotion: 'reduce', args: ['--window-size=1384,1050'] });
      try {
        const page = await context.newPage(); watch(page, 'native-zoom');
        const settings = await context.newPage();
        await settings.goto('chrome://settings/appearance');
        assert(await settings.evaluate(() => typeof chrome.settingsPrivate?.setDefaultZoom === 'function'), 'Native browser zoom unavailable: full Chromium is required; no proxy was substituted');
        await settings.evaluate(() => chrome.settingsPrivate.setDefaultZoom(1));
        await page.bringToFront();
        await page.goto(origin + '/index.html');
        const frame = await page.evaluate(() => ({ width: outerWidth - innerWidth, height: outerHeight - innerHeight }));
        const session = await context.newCDPSession(page);
        const window = await session.send('Browser.getWindowForTarget');
        await session.send('Browser.setWindowBounds', { windowId: window.windowId, bounds: { width: 1366 + frame.width, height: 950 + frame.height } });
        await page.waitForFunction(() => innerWidth === 1366);
        const baseline = await page.evaluate(() => ({ innerWidth, outerWidth, dpr: devicePixelRatio }));
        for (const factor of zoomFactors) {
          await settings.evaluate(value => chrome.settingsPrivate.setDefaultZoom(value), factor);
          for (const route of routes) {
            await page.goto(origin + '/' + route); await settle(page);
            const evidence = await page.evaluate(() => {
              const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;left:-10000px;width:100px;height:10px;font-size:16px'; document.body.append(probe);
              const value = { innerWidth, outerWidth, dpr: devicePixelRatio, visualScale: visualViewport.scale, probeCSSWidth: probe.getBoundingClientRect().width, probeFont: getComputedStyle(probe).fontSize };
              probe.remove(); return value;
            });
            const label = 'zoom-' + Math.round(factor * 100) + '-' + fileLabel(route);
            check(Math.abs(evidence.innerWidth - baseline.innerWidth / factor) <= 2, label + ': zoom must reduce the CSS layout viewport');
            check(evidence.outerWidth === baseline.outerWidth, label + ': native browser window must remain unchanged');
            check(Math.abs(evidence.dpr / baseline.dpr - factor) < .01 && evidence.visualScale === 1, label + ': native zoom must change layout/DPR without pinch scaling');
            check(evidence.probeCSSWidth === 100 && evidence.probeFont === '16px', label + ': CSS units must remain CSS units under browser zoom');
            const metrics = await session.send('Page.getLayoutMetrics');
            if (metrics.cssVisualViewport.zoom !== undefined) check(Math.abs(metrics.cssVisualViewport.zoom - factor) < .01, label + ': CDP-reported browser zoom');
            const proof = { label, requestedZoom: factor, method: 'native-browser-default-zoom', baseline, ...evidence, cdpBrowserZoom: metrics.cssVisualViewport.zoom, probeDevicePixelWidth: evidence.probeCSSWidth * evidence.dpr };
            zoomEvidence.push(proof);
            const before = failures.length; await inspect(page, label);
            if (zoomCapture(route) || failures.length > before) {
              // Playwright's inferred CSS clip can crop native-zoom screenshots.
              // CDP without a clip captures the actual complete browser surface.
              const capture = await session.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
              const png = Buffer.from(capture.data, 'base64');
              proof.screenshot = { width: png.readUInt32BE(16), height: png.readUInt32BE(20), method: 'CDP-full-surface' };
              check(proof.screenshot.width === metrics.layoutViewport.clientWidth, label + ': screenshot must retain the whole native viewport');
              fs.writeFileSync(path.join(output, label + '.png'), png);
            }
          }
          console.log('Native browser zoom checked: ' + Math.round(factor * 100) + '% on ' + routes.length + ' pages');
        }
        await settings.evaluate(() => chrome.settingsPrivate.setDefaultZoom(1));
      } finally { await context.close(); }
    }
    completed = true;
  } finally {
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ completed, passed: completed && failures.length === 0, pages: routes.length, widths, nativeZoomFactors: zoomFactors, keyboardRegions, keyboardTabEntries, failures, zoomEvidence, observations }, null, 2));
  }
  assert.equal(failures.length, 0, failures.join('\n'));
  console.log('PASS: ' + observations.length + ' rendered readability/reflow checks on ' + routes.length + ' pages; ' + zoomEvidence.length + ' native browser zoom checks; ' + keyboardRegions + ' keyboard scroll checks; ' + keyboardTabEntries + ' Tab entries.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
