/**
 * QA de navegador opcional. Requiere Playwright (o playwright-core) y axe-core.
 * node tests/browser.test.cjs
 * PLAYWRIGHT_MODULE y AXE_PATH permiten reutilizar paquetes fuera del sitio.
 * BROWSER_PATH permite usar Chrome/Edge instalado, sin descargar Chromium.
 * QA_SCREENSHOTS guarda las capturas y el informe en el directorio indicado.
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const axeScript = fs.readFileSync(process.env.AXE_PATH || require.resolve('axe-core/axe.min.js'), 'utf8');
const root = path.resolve(__dirname, '..');
const screenshotDir = process.env.QA_SCREENSHOTS ? path.resolve(process.env.QA_SCREENSHOTS) : null;
const pages = ['index.html', ...fs.readdirSync(path.join(root, 'casos')).filter(file => file.endsWith('.html')).map(file => 'casos/' + file)];
const viewports = [{ width: 1920, height: 1080 }, { width: 1440, height: 1000 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 740 }];
const failures = [];
const report = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const server = http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404).end('Not found'); return;
    }
    response.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
  } catch { response.writeHead(400).end('Bad request'); }
});
async function audit(page, label) {
  await page.addScriptTag({ content: axeScript });
  const results = await page.evaluate(async () => {
    const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    return result.violations.map(item => ({ id: item.id, impact: item.impact, description: item.description, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }));
  });
  report.push({ label, accessibilityViolations: results });
  for (const violation of results) failures.push(label + ': axe ' + violation.id + ': ' + violation.nodes.map(node => node.target.join(' ')).join(', '));
}
async function screenshot(page, label) {
  if (screenshotDir) {
    await page.screenshot({ path: path.join(screenshotDir, label + '.png'), fullPage: true, animations: 'disabled' });
    if (label.endsWith('-index') || label.endsWith('-dialog-cfrp')) {
      await page.screenshot({ path: path.join(screenshotDir, label + '-viewport.png'), animations: 'disabled' });
    }
  }
}
async function main() {
  if (screenshotDir) fs.mkdirSync(screenshotDir, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}) });
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce', locale: 'es-PE' });
      const page = await context.newPage();
      page.on('pageerror', error => failures.push(viewport.width + 'px: JavaScript: ' + error.message));
      page.on('response', response => { if (response.status() >= 400) failures.push('HTTP ' + response.status() + ': ' + response.url()); });
      for (const file of pages) {
        const label = viewport.width + '-' + path.basename(file, '.html');
        const response = await page.goto(origin + '/' + file);
        check(response.ok(), label + ': documento no accesible');
        await page.evaluate(async () => {
          document.querySelectorAll('img').forEach(img => img.loading = 'eager');
          await Promise.all([...document.images].map(img => img.decode().catch(() => {})));
          await document.fonts.ready;
        });
        const state = await page.evaluate(() => ({
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          brokenImages: [...document.images].filter(img => !img.complete || img.naturalWidth === 0).map(img => img.getAttribute('src')),
          mainCount: document.querySelectorAll('main').length,
          h1Count: document.querySelectorAll('h1').length
        }));
        check(!state.horizontalOverflow, label + ': desbordamiento horizontal');
        check(state.brokenImages.length === 0, label + ': imágenes rotas: ' + state.brokenImages.join(', '));
        check(state.mainCount === 1 && state.h1Count === 1, label + ': estructura main/h1');
        await screenshot(page, label);
        await audit(page, label);
        if (file !== 'index.html') continue;
        if (viewport.width <= 768) {
          await page.locator('#nav-toggle').click();
          check(await page.locator('#nav-toggle').getAttribute('aria-expanded') === 'true', label + ': menú no se abre');
          await page.keyboard.press('Escape');
          check(await page.locator('#nav-toggle').getAttribute('aria-expanded') === 'false', label + ': Escape no cierra menú');
          check(await page.locator('#nav-toggle').getAttribute('aria-label') === 'Abrir menú', label + ': etiqueta de menú incorrecta');
          check(await page.locator('#nav-toggle').evaluate(node => node === document.activeElement), label + ': Escape no devuelve foco al menú');
          await page.locator('#nav-toggle').click();
          await page.locator('#primary-nav a').first().click();
          check(await page.locator('#nav-toggle').getAttribute('aria-expanded') === 'false', label + ': enlace no cierra menú');
        }
        for (const category of ['sismo', 'automatizacion', 'investigacion', 'todos']) {
          await page.locator('[data-filter="' + category + '"]').click();
          const expected = await page.locator('.project-card').evaluateAll((cards, selected) => cards.filter(card => selected === 'todos' || card.dataset.category.split(' ').includes(selected)).length, category);
          check(await page.locator('.project-card:visible').count() === expected, label + ': filtro ' + category);
          check(await page.locator('[data-filter][aria-pressed="true"]').count() === 1, label + ': selección ARIA de filtros');
        }
        for (const key of ['cfrp', 'e030', 'lisp', 'columnas']) {
          const trigger = page.locator('[data-project="' + key + '"]');
          await trigger.focus();
          await page.keyboard.press('Enter');
          check(await page.locator('#project-dialog').evaluate(node => node.open), label + ': diálogo ' + key);
          check(await page.locator('#dialog-close').evaluate(node => node === document.activeElement), label + ': foco inicial del diálogo');
          const target = await page.locator('#dialog-case-link').getAttribute('href');
          check((await context.request.get(new URL(target, origin + '/').href)).ok(), label + ': ficha ' + key);
          if (key === 'cfrp') {
            await screenshot(page, viewport.width + '-dialog-cfrp');
            await audit(page, label + '-dialog');
          }
          await page.keyboard.press('Escape');
          check(!await page.locator('#project-dialog').evaluate(node => node.open), label + ': Escape no cierra diálogo');
          check(await trigger.evaluate(node => node === document.activeElement), label + ': foco no regresa al proyecto');
        }
        await page.locator('#span-input').fill('10');
        await page.locator('#load-input').fill('20');
        check((await page.locator('#reaction-value').textContent()).includes('100,0'), label + ': reacción qL/2');
        check((await page.locator('#moment-value').textContent()).includes('250,0'), label + ': momento qL²/8');
        await page.locator('#span-input').focus();
        await page.keyboard.press('ArrowRight');
        check(await page.locator('#span-input').inputValue() === '10.5', label + ': teclado del laboratorio');
        if (await page.locator('#lab-reset').count()) {
          await page.locator('#lab-reset').click();
          check(await page.locator('#span-input').inputValue() === '6' && await page.locator('#load-input').inputValue() === '18', label + ': restablecer laboratorio');
        }
      }
      await context.close();
    }
    const noJs = await browser.newContext({ javaScriptEnabled: false });
    const page = await noJs.newPage();
    await page.goto(origin);
    check(await page.locator('a[data-project][href^="casos/"]').count() === 4, 'Sin JavaScript: fichas deben ser accesibles');
    await noJs.close();
  } finally {
    await browser.close();
    if (screenshotDir) fs.writeFileSync(path.join(screenshotDir, 'report.json'), JSON.stringify({ pages: pages.length, viewports: viewports.map(viewport => viewport.width), failures, audits: report }, null, 2));
  }
  assert.equal(failures.length, 0, failures.join('\n'));
  console.log('PASS: ' + pages.length + ' páginas × ' + viewports.length + ' tamaños; imágenes, filtros, teclado, diálogos, laboratorio, enlaces sin JS y auditoría axe WCAG 2.1 AA.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
