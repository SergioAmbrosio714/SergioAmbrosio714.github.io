/** End-to-end bilingual demonstrations and code catalogue. External Playwright/axe only. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const axe = fs.readFileSync(process.env.AXE_PATH || require.resolve('axe-core/axe.min.js'), 'utf8');
const root = path.resolve(__dirname, '..');
const core = require('../demo-core.js');
const output = process.env.QA_SCREENSHOTS ? path.join(path.resolve(process.env.QA_SCREENSHOTS), 'demos') : fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-demos-'));
const sample = fs.readFileSync(path.join(root, 'python/examples/storey-results.csv'), 'utf8');
const fixture = name => JSON.parse(fs.readFileSync(path.join(root, 'python/fixtures/' + name + '.json'), 'utf8'));
const standards = JSON.parse(fs.readFileSync(path.join(root, 'data/standards.json'), 'utf8'));
const homeOnly = process.env.DEMO_QA_MODE === 'homes';
const accessibilityOnly = homeOnly || process.env.DEMO_QA_MODE === 'accessibility';
const failures = [], audits = [];
let pageChecks = 0, downloadsChecked = 0;
const check = (condition, label) => { if (!condition) { failures.push(label); console.error('FAIL: ' + label); } };
function close(actual, expected, label = 'result') {
  if (typeof expected === 'number') {
    assert(Number.isFinite(actual) && Math.abs(actual - expected) <= Math.max(1e-14, Math.abs(expected) * 1e-12), label + ': numerical mismatch');
  } else if (expected && typeof expected === 'object') {
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), label + ': fields');
    Object.keys(expected).forEach(key => close(actual[key], expected[key], label + '.' + key));
  } else assert.equal(actual, expected, label);
}
const server = http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.csv': 'text/csv; charset=utf-8', '.json': 'application/json', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
  } catch { response.writeHead(400).end(); }
});
async function audit(page, label) {
  await page.addScriptTag({ content: axe });
  const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })));
  audits.push({ label, violations });
  violations.forEach(item => check(false, label + ': axe ' + item.id + ' ' + JSON.stringify(item.nodes)));
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ': horizontal overflow');
}
async function settled(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function keyboardScrollRegions(page, label) {
  for (const region of await page.locator('#demo-chart, #demo-table, .demo-documentation pre').all()) {
    if (!await region.evaluate(node => node.scrollWidth > node.clientWidth + 1)) continue;
    await region.evaluate(node => { node.scrollLeft = 0; }); await region.focus();
    const focused = await region.evaluate(node => node === document.activeElement);
    check(focused, label + ': scrollable content must be keyboard focusable');
    if (focused) {
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(node => node.scrollLeft > 0, await region.elementHandle(), { timeout: 2000 });
      await region.evaluate(node => { node.scrollLeft = 0; });
    }
  }
  await page.evaluate(() => window.scrollTo(0, 0)); await settled(page);
}
async function download(page, kind, extension, label) {
  const [item] = await Promise.all([page.waitForEvent('download'), page.locator('#export-' + extension).click()]);
  assert.equal(item.suggestedFilename(), kind + (extension === 'svg' ? '-plot.svg' : '-processed.' + extension));
  const target = path.join(output, label + '-' + item.suggestedFilename());
  await item.saveAs(target);
  assert.equal(await item.failure(), null);
  downloadsChecked++;
  return fs.readFileSync(target, 'utf8');
}
async function exportsMatch(page, kind, expected, label) {
  close(JSON.parse(await download(page, kind, 'json', label)), expected, label);
  const csv = await download(page, kind, 'csv', label);
  const rows = csv.trimEnd().split('\n').map(line => line.split(','));
  const groups = kind === 'storeys' ? expected.cases : expected.scenarios;
  assert.equal(rows.length - 1, groups.reduce((count, item) => count + item.points.length, 0));
  const actualColumns = rows.shift();
  const expectedCSV = core.exportCSV(expected).trimEnd().split('\n').map(line => line.split(','));
  assert.deepEqual(actualColumns, expectedCSV.shift());
  rows.forEach((row, index) => row.forEach((cell, column) => {
    const value = expectedCSV[index][column];
    if (cell !== '' && value !== '' && Number.isFinite(Number(value))) close(Number(cell), Number(value), label + '/CSV');
    else assert.equal(cell, value);
  }));
  const svg = await download(page, kind, 'svg', label);
  const drawing = await page.evaluate(text => {
    const document = new DOMParser().parseFromString(text, 'image/svg+xml');
    return { errors: document.querySelectorAll('parsererror').length, root: document.documentElement.localName, title: document.querySelector('title')?.textContent, lines: document.querySelectorAll('polyline').length, text: document.documentElement.textContent, points: [...document.querySelectorAll('polyline')].map(line => line.getAttribute('points')) };
  }, svg);
  assert.equal(drawing.errors, 0, label + ': malformed SVG');
  assert.equal(drawing.root, 'svg');
  assert(drawing.title && drawing.lines === groups.length, label + ': exported chart content');
  assert(!drawing.points.some(points => /NaN|Infinity/.test(points)), label + ': nonfinite SVG coordinates');
  groups.forEach(item => check(drawing.text.includes(item.case || item.scenario), label + ': SVG must retain legend ' + (item.case || item.scenario)));
}
async function upload(page, name, text) {
  await page.locator('#results-file').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.isBuffer(text) ? text : Buffer.from(text, 'utf8') });
}
async function runStoreys(page, label, language, races) {
  await exportsMatch(page, 'storeys', fixture('storey-results'), label + '-initial');
  await page.locator('#reference-case').focus();
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#reference-case').value === 'SERVICE_B');
  close(JSON.parse(await download(page, 'storeys', 'json', label + '-reference')), core.processCSV(sample, 'SERVICE_B'));
  const imported = sample.replaceAll('SERVICE_A', 'IMPORTED_A').replaceAll('SERVICE_B', 'IMPORTED_B');
  await upload(page, 'comparison.csv', imported);
  await page.waitForFunction(() => document.querySelector('#reference-case').value === 'IMPORTED_A');
  check((await page.locator('#dataset-label').textContent()).includes(language === 'es' ? 'ARCHIVO IMPORTADO' : 'IMPORTED FILE'), label + ': imported data must be labelled');
  close(JSON.parse(await download(page, 'storeys', 'json', label + '-import')), core.processCSV(imported));
  const badInputs = [sample.replace('m,mm', 'm,kN'), sample.replace(',3,2,m,mm', ',3,,m,mm'), sample.replaceAll('SERVICE_A', '=1+1'), Buffer.from([0xff, 0xfe, 0x80])];
  for (let index = 0; index < badInputs.length; index++) {
    await upload(page, 'invalid-' + index + '.csv', badInputs[index]);
    await page.waitForFunction(() => !document.querySelector('#demo-error').hidden);
    check(!await page.locator('#demo-output').isVisible(), label + ': stale output after invalid import');
    check(await page.locator('#reference-case').isDisabled(), label + ': stale reference control after invalid import');
    check((await page.locator('#demo-error').textContent()).length > 20, label + ': useful error message');
    if (index === 0) await audit(page, label + '-invalid');
    await page.locator('#demo-load-example').focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#demo-error').hidden && !document.querySelector('#demo-output').hidden);
    check(await page.locator('#results-file').inputValue() === '', label + ': example reset must clear imported file');
    check(await page.locator('#reference-case').inputValue() === 'SERVICE_A', label + ': reset reference');
  }
  if (races) {
    // A manually released read makes this regression deterministic, without sleeps.
    await upload(page, 'delayed-reset.csv', imported);
    await page.waitForFunction(() => typeof window.__releaseImports['delayed-reset.csv'] === 'function');
    await page.locator('#demo-load-example').click();
    await page.evaluate(() => window.__releaseImports['delayed-reset.csv']()); await settled(page);
    check(await page.locator('#reference-case').inputValue() === 'SERVICE_A', label + ': an obsolete async read must not replace reset');
    await upload(page, 'delayed-first.csv', imported);
    await page.waitForFunction(() => typeof window.__releaseImports['delayed-first.csv'] === 'function');
    const second = imported.replaceAll('IMPORTED_', 'LATEST_');
    await upload(page, 'latest.csv', second);
    await page.waitForFunction(() => document.querySelector('#reference-case').value === 'LATEST_A');
    await page.evaluate(() => window.__releaseImports['delayed-first.csv']()); await settled(page);
    check(await page.locator('#reference-case').inputValue() === 'LATEST_A', label + ': latest file selection must win async reads');
    await page.locator('#demo-load-example').click();
  }
}
async function runCantilever(page, label) {
  await exportsMatch(page, 'cantilever', fixture('cantilever'), label + '-initial');
  await page.locator('#param-load').fill('20');
  check(!await page.locator('#demo-output').isVisible(), label + ': editing a parameter leaves stale downloadable results');
  await page.locator('#cantilever-form button[type="submit"]').focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('#demo-output').hidden);
  const changed = JSON.parse(await download(page, 'cantilever', 'json', label + '-changed'));
  close(changed.scenarios[0].input.tip_load_n, 20000);
  close(changed.scenarios[0].summary.tip_displacement_m, .004);
  close(changed.scenarios[0].summary.max_abs_bending_stress_pa, 60e6);
  await page.locator('#param-depth').fill('0');
  await page.locator('#cantilever-form button[type="submit"]').click();
  await page.waitForFunction(() => !document.querySelector('#demo-error').hidden);
  check(!await page.locator('#demo-output').isVisible(), label + ': invalid parameter retains output');
  await audit(page, label + '-invalid');
  await page.locator('#demo-reset').focus(); await page.keyboard.press('Enter');
  check(await page.locator('#param-load').inputValue() === '10' && await page.locator('#param-depth').inputValue() === '200', label + ': reset input values');
  close(JSON.parse(await download(page, 'cantilever', 'json', label + '-reset')), fixture('cantilever'));
  await page.locator('#param-load').fill('0'); await page.locator('#cantilever-form button[type="submit"]').click();
  const unloaded = JSON.parse(await download(page, 'cantilever', 'json', label + '-zero'));
  unloaded.scenarios.forEach(item => close(item.summary.tip_displacement_m, 0));
  await page.locator('#demo-reset').click();
}
async function main() {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}) });
  try {
    for (const width of (homeOnly ? [] : [1440, 768, 390, 320])) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce', acceptDownloads: true });
      await context.addInitScript(() => {
        const original = File.prototype.arrayBuffer;
        window.__releaseImports = {};
        File.prototype.arrayBuffer = function () {
          const promise = original.call(this);
          return this.name.startsWith('delayed-') ? new Promise((resolve, reject) => { window.__releaseImports[this.name] = () => promise.then(resolve, reject); }) : promise;
        };
      });
      const page = await context.newPage();
      page.on('pageerror', error => failures.push(width + ': JS ' + error.message));
      page.on('console', message => { if (message.type() === 'error') failures.push(width + ': console ' + message.text()); });
      page.on('response', response => { if (response.status() >= 400) failures.push('HTTP ' + response.status() + ': ' + response.url()); });
      page.on('request', request => { if (request.method() !== 'GET') failures.push('Unexpected network method: ' + request.method()); });
      for (const language of ['es', 'en']) for (const kind of ['storeys', 'cantilever']) {
        const slug = kind === 'storeys' ? 'resultados-por-nivel' : 'voladizo-parametrico';
        const route = (language === 'en' ? 'en/' : '') + 'laboratorio/' + slug + '.html';
        const label = width + '-' + language + '-' + kind;
        assert((await page.goto(origin + '/' + route)).ok(), route + ' missing');
        await page.waitForSelector('#demo-chart svg'); await page.evaluate(() => document.fonts.ready);
        check(await page.locator('h1').count() === 1 && await page.locator('main').count() === 1, label + ': page structure');
        await keyboardScrollRegions(page, label);
        await audit(page, label);
        await page.screenshot({ path: path.join(output, label + '.png'), fullPage: true, animations: 'disabled' });
        const capture = page.locator('details.demo-capture');
        await capture.locator('summary').focus(); await page.keyboard.press('Enter');
        check(await capture.evaluate(node => node.open), label + ': screenshot disclosure opens by keyboard');
        await capture.locator('img').evaluate(async node => { node.loading = 'eager'; await node.decode(); });
        check(await capture.locator('img').evaluate(node => node.naturalWidth > 0), label + ': published screenshot loads');
        await audit(page, label + '-capture-expanded');
        await capture.locator('summary').click();
        if (!accessibilityOnly) {
          if (kind === 'storeys') await runStoreys(page, label, language, width === 390);
          else await runCantilever(page, label);
        }
        pageChecks++;
        console.log('Checked demonstration: ' + label);
      }
      if (!accessibilityOnly && [1440, 390].includes(width)) for (const language of ['es', 'en']) {
        const label = width + '-' + language + '-standards';
        await page.goto(origin + '/' + (language === 'en' ? 'en/' : '') + 'normativa/index.html');
        assert.equal(await page.locator('details.code-entry').count(), standards.items.length);
        for (const item of standards.items) {
          const detail = page.locator('details.code-entry[id="' + item.id + '"]');
          await detail.locator('summary').focus(); await page.keyboard.press('Enter');
          check(await detail.evaluate(node => node.open), label + ': keyboard expands ' + item.id);
          const sources = await detail.locator('.code-sources a').evaluateAll(nodes => nodes.map(node => ({ href: node.href, rel: node.rel, target: node.target })));
          assert.deepEqual(sources.map(source => source.href).sort(), item.references.map(source => source.url).sort(), label + '/' + item.id + ': official source links');
          sources.forEach(source => check(source.href.startsWith('https://') && source.target === '_blank' && source.rel.includes('noopener'), label + ': source link attributes'));
        }
        check(await page.locator('.code-case').count() === 3, label + ': three conceptual workflows');
        await audit(page, label + '-expanded');
        await page.screenshot({ path: path.join(output, label + '.png'), fullPage: true, animations: 'disabled' });
        pageChecks++;
      }
      await context.close();
    }
    if (accessibilityOnly) for (const width of [1920, 1440, 768, 390, 320]) for (const language of ['es', 'en']) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const label = width + '-' + language + '-home-previews';
      page.on('pageerror', error => failures.push(label + ': JS ' + error.message));
      await page.goto(origin + '/' + (language === 'en' ? 'en/' : ''));
      await page.locator('.automation-home img').evaluateAll(async nodes => { nodes.forEach(node => node.loading = 'eager'); await Promise.all(nodes.map(node => node.decode())); });
      check(await page.locator('.automation-home img').count() === 2, label + ': two actual demonstration previews');
      await page.locator('details.automation-applications').evaluate(node => { node.open = true; });
      await audit(page, label);
      await context.close(); pageChecks++;
    }
    if (!accessibilityOnly) for (const language of ['es', 'en']) for (const slug of ['resultados-por-nivel', 'voladizo-parametrico']) {
      const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await page.goto(origin + '/' + (language === 'en' ? 'en/' : '') + 'laboratorio/' + slug + '.html');
      check(await page.locator('noscript .demo-notice').isVisible(), language + '/' + slug + ': no-JS explanation');
      const links = await page.locator('.demo-top-links a[download]').evaluateAll(nodes => nodes.map(node => node.href));
      assert.equal(links.length, 2);
      for (const link of links) assert((await context.request.get(link)).ok(), 'No-JS Python/CSV download unavailable');
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), language + '/' + slug + ': no-JS overflow');
      await context.close();
    }
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ pageChecks, downloadsChecked, failures, audits }, null, 2));
  }
  assert.equal(failures.length, 0, failures.join('\n'));
  console.log(homeOnly ? `PASS: ${pageChecks} bilingual home accessibility checks; actual previews and expanded application descriptions.` : accessibilityOnly ? `PASS: ${pageChecks} focused demo/home accessibility checks; keyboard scrolling, expanded captures and actual previews.` : `PASS: ${pageChecks} bilingual demo/catalogue checks; ${downloadsChecked} JSON/CSV/SVG downloads; imports, validation, race handling, keyboard, reset, no-JS and axe.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
