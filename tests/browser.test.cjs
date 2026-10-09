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
function htmlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || ['templates', 'node_modules', '__pycache__'].includes(entry.name)) return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(file) : file.endsWith('.html') ? [path.relative(root, file).split(path.sep).join('/')] : [];
  });
}
const homes = ['index.html', 'en/index.html'];
const pages = (process.env.QA_MODE === 'homes' ? homes : htmlFiles(root)).sort((a, b) => Number(homes.includes(b)) - Number(homes.includes(a)) || a.localeCompare(b));
const viewports = [{ width: 1920, height: 1080 }, { width: 1440, height: 1000 }, { width: 1366, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 740 }];
const failures = [];
const report = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const server = http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404).end('Not found'); return;
    }
    response.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.pdf': 'application/pdf' })[path.extname(file)] || 'application/octet-stream');
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
async function checkHeroModel(page, label) {
  const model = page.locator('.hero-model');
  const canvas = page.locator('#structural-model');
  await page.waitForSelector('.hero-model.is-ready');
  await model.scrollIntoViewIfNeeded();
  check(await canvas.isVisible(), label + ': modelo 3D no visible');
  const drawing = await canvas.evaluate(element => {
    const pixels = element.getContext('2d').getImageData(0, 0, element.width, element.height).data;
    const colors = new Set();
    for (let index = 0; index < pixels.length; index += 64) {
      if (pixels[index + 3]) colors.add(pixels[index] + ',' + pixels[index + 1] + ',' + pixels[index + 2]);
    }
    return { width: element.width, height: element.height, colors: colors.size };
  });
  check(drawing.width > 100 && drawing.height > 100 && drawing.colors > 8, label + ': canvas vacío o sin dibujo estructural');
  const initial = await canvas.evaluate(element => element.toDataURL());
  // La preferencia de movimiento reducido debe conservar la vista sin actividad continua.
  await page.waitForTimeout(200);
  check(await canvas.evaluate(element => element.toDataURL()) === initial, label + ': movimiento no solicitado con reduced-motion');
  let previous = initial;
  for (const view of ['front', 'side', 'iso']) {
    const button = page.locator('[data-model-view="' + view + '"]');
    await button.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    check(await button.getAttribute('aria-pressed') === 'true', label + ': selección accesible de vista ' + view);
    check(await page.locator('[data-model-view][aria-pressed="true"]').count() === 1, label + ': más de una vista activa');
    const current = await canvas.evaluate(element => element.toDataURL());
    check(current !== previous, label + ': vista ' + view + ' no cambia la proyección');
    previous = current;
  }
  await page.locator('[data-model-view="front"]').click();
  await page.locator('#model-reset').click();
  check(await page.locator('[data-model-view="iso"]').getAttribute('aria-pressed') === 'true', label + ': restablecer vista isométrica');
  const bounds = await canvas.boundingBox();
  const beforeDrag = await canvas.evaluate(element => element.toDataURL());
  await page.mouse.move(bounds.x + bounds.width * .4, bounds.y + bounds.height * .5);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .6, bounds.y + bounds.height * .55, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  check(await model.getAttribute('data-view') === 'custom', label + ': arrastre no permite orientar el modelo');
  check(await canvas.evaluate(element => element.toDataURL()) !== beforeDrag, label + ': arrastre no cambia la proyección');
  await page.locator('#model-reset').click();
  if (screenshotDir) await model.screenshot({ path: path.join(screenshotDir, label + '-hero-model.png'), animations: 'disabled' });
  const staticToggle = page.locator('#model-static-toggle');
  await staticToggle.click();
  check(await staticToggle.getAttribute('aria-pressed') === 'true', label + ': vista estática no seleccionada');
  check(await model.locator('img').isVisible(), label + ': alternativa estática no visible');
  check(!await canvas.isVisible(), label + ': canvas sigue visible en modo estático');
  await staticToggle.click();
  check(await staticToggle.getAttribute('aria-pressed') === 'false' && await canvas.isVisible(), label + ': no regresa a vista interactiva');
  await page.evaluate(() => window.scrollTo(0, 0));
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
      const selectedPages = [1440, 390].includes(viewport.width) ? pages : homes;
      for (const file of selectedPages) {
        const isHome = homes.includes(file);
        const language = file.startsWith('en/') || file === 'cv/en.html' ? 'en' : 'es';
        const label = viewport.width + '-' + file.replace(/\.html$/, '').replaceAll('/', '-');
        const response = await page.goto(origin + '/' + file);
        check(response.ok(), label + ': documento no accesible');
        await page.evaluate(async () => {
          for (let top = 0; top < document.documentElement.scrollHeight; top += window.innerHeight * .85) {
            window.scrollTo(0, top);
            await new Promise(requestAnimationFrame);
          }
          document.querySelectorAll('img').forEach(img => img.loading = 'eager');
          await Promise.all([...document.images].map(img => img.decode().catch(() => {})));
          await document.fonts.ready;
          window.scrollTo(0, 0);
        });
        const state = await page.evaluate(() => ({
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          brokenImages: [...document.images].filter(img => !img.complete || img.naturalWidth === 0).map(img => img.getAttribute('src')),
          mainCount: document.querySelectorAll('main').length,
          h1Count: document.querySelectorAll('h1').length,
          emptyStylesheets: [...document.styleSheets].filter(sheet => sheet.href && sheet.cssRules.length === 0).map(sheet => sheet.href)
        }));
        check(!state.horizontalOverflow, label + ': desbordamiento horizontal');
        check(state.brokenImages.length === 0, label + ': imágenes rotas: ' + state.brokenImages.join(', '));
        check(state.mainCount === 1 && state.h1Count === 1, label + ': estructura main/h1');
        check(state.emptyStylesheets.length === 0, label + ': CSS sin reglas válidas');
        await screenshot(page, label);
        await page.locator('details.image-provenance').evaluateAll(elements => elements.forEach(element => element.open = true));
        check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), label + ': metadatos de imagen causan desbordamiento');
        await audit(page, label);
        if (await page.locator('#nav-toggle').count() && await page.locator('#nav-toggle').isVisible()) {
          await page.locator('#nav-toggle').click();
          check(await page.locator('#nav-toggle').getAttribute('aria-expanded') === 'true', label + ': menú no se abre');
          await page.keyboard.press('Escape');
          check(await page.locator('#nav-toggle').getAttribute('aria-expanded') === 'false', label + ': Escape no cierra menú');
          check(await page.locator('#nav-toggle').getAttribute('aria-label') === (language === 'es' ? 'Abrir menú' : 'Open menu'), label + ': etiqueta de menú incorrecta');
          check(await page.locator('#nav-toggle').evaluate(node => node === document.activeElement), label + ': Escape no devuelve foco al menú');
          if (isHome) {
            await page.locator('#nav-toggle').click();
            await page.locator('#primary-nav a').first().click();
            check(await page.locator('#nav-toggle').getAttribute('aria-expanded') === 'false', label + ': enlace no cierra menú');
          }
        }
        if (!isHome) continue;
        await checkHeroModel(page, label);
        const categories = await page.locator('[data-filter]').evaluateAll(buttons => buttons.map(button => button.dataset.filter));
        for (const category of [...categories.filter(category => category !== 'todos'), 'todos']) {
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
          check((await context.request.get(new URL(target, page.url()).href)).ok(), label + ': ficha ' + key);
          if (key === 'cfrp') {
            await screenshot(page, label + '-dialog-cfrp');
            await audit(page, label + '-dialog');
          }
          await page.keyboard.press('Escape');
          // Native focus restoration can precede the queued close event. Wait for
          // app cleanup as well, so that event cannot affect the next dialog.
          await page.waitForFunction(project => {
            const dialog = document.getElementById('project-dialog');
            const trigger = document.querySelector('[data-project="' + project + '"]');
            return !dialog.open && !document.body.classList.contains('dialog-open') && document.activeElement === trigger;
          }, key, { timeout: 2000 }).catch(error => {
            failures.push(label + ': cierre y retorno de foco no completados para ' + key);
            throw error;
          });
          check(!await page.locator('#project-dialog').evaluate(node => node.open), label + ': Escape no cierra diálogo');
          check(await trigger.evaluate(node => node === document.activeElement), label + ': foco no regresa al proyecto ' + key);
        }
        const disclosure = page.locator('details.beam-disclosure');
        if (!await disclosure.evaluate(element => element.open)) await disclosure.locator('summary').click();
        await page.locator('#span-input').fill('10');
        await page.locator('#load-input').fill('20');
        check((await page.locator('#reaction-value').textContent()).includes(language === 'es' ? '100,0' : '100.0'), label + ': reacción qL/2');
        check((await page.locator('#moment-value').textContent()).includes(language === 'es' ? '250,0' : '250.0'), label + ': momento qL²/8');
        await page.locator('#span-input').focus();
        await page.keyboard.press('ArrowRight');
        check(await page.locator('#span-input').inputValue() === '10.5', label + ': teclado del laboratorio');
        if (await page.locator('#lab-reset').count()) {
          await page.locator('#lab-reset').click();
          check(await page.locator('#span-input').inputValue() === '6' && await page.locator('#load-input').inputValue() === '18', label + ': restablecer laboratorio');
        }
        await audit(page, label + '-lab-open');
        console.log('Checked home: ' + label);
      }
      await context.close();
    }
    for (const file of homes) for (const width of [1440, 390]) {
      const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 900 } });
      const page = await noJs.newPage();
      await page.goto(origin + '/' + file);
      check(await page.locator('a[data-project][href]').count() === 4, 'Sin JavaScript: fichas deben ser accesibles');
      check(await page.locator('.hero-model img').isVisible(), 'Sin JavaScript: esquema alternativo no visible');
      check(await page.locator('.hero-model img').evaluate(img => img.complete && img.naturalWidth > 0), 'Sin JavaScript: esquema alternativo no carga');
      check(!await page.locator('[data-model-view]').first().isVisible(), 'Sin JavaScript: controles 3D inoperantes deben estar ocultos');
      check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Sin JavaScript: desbordamiento horizontal a ' + width + 'px');
      await screenshot(page, width + '-' + (file.startsWith('en/') ? 'en-' : '') + 'no-js');
      await noJs.close();
    }
    for (const file of homes) {
    const noCanvas = await browser.newContext();
    await noCanvas.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
    const fallbackPage = await noCanvas.newPage();
    await fallbackPage.goto(origin + '/' + file);
    check(await fallbackPage.locator('.hero-model img').isVisible(), 'Sin canvas: esquema alternativo no visible');
    check(!await fallbackPage.locator('.hero-model').evaluate(element => element.classList.contains('is-ready')), 'Sin canvas: controles 3D no deben activarse');
    await noCanvas.close();
    }
    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    const touchPage = await touch.newPage();
    await touchPage.goto(origin);
    await touchPage.waitForSelector('.hero-model.is-ready');
    const touchCanvas = touchPage.locator('#structural-model');
    await touchCanvas.scrollIntoViewIfNeeded();
    const touchSession = await touch.newCDPSession(touchPage);
    async function swipe(dx, dy) {
      const bounds = await touchCanvas.boundingBox();
      const x = bounds.x + bounds.width * .5, y = bounds.y + bounds.height * .5;
      await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let step = 1; step <= 6; step++) {
        await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * step / 6, y: y + dy * step / 6 }] });
      }
      await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await touchPage.waitForTimeout(200);
    }
    const scrollBefore = await touchPage.evaluate(() => window.scrollY);
    await swipe(0, -110);
    check(await touchPage.evaluate(() => window.scrollY) > scrollBefore + 30, 'Táctil: el modelo no debe bloquear el desplazamiento vertical');
    check(await touchPage.locator('.hero-model').getAttribute('data-view') === 'iso', 'Táctil: desplazar la página no debe girar el modelo');
    await touchCanvas.scrollIntoViewIfNeeded();
    await swipe(75, 0);
    check(await touchPage.locator('.hero-model').getAttribute('data-view') === 'custom', 'Táctil: arrastre horizontal no gira el modelo');
    await touch.close();
  } finally {
    await browser.close();
    if (screenshotDir) fs.writeFileSync(path.join(screenshotDir, 'report.json'), JSON.stringify({ pages: pages.length, viewports: viewports.map(viewport => viewport.width), failures, audits: report }, null, 2));
  }
  assert.equal(failures.length, 0, failures.join('\n'));
  console.log('PASS: ' + pages.length + ' páginas ES/EN en escritorio y móvil; ambas portadas en ' + viewports.length + ' tamaños; modelo 3D, táctil, vista estática, movimiento reducido, alternativas sin JS/canvas, filtros, teclado, diálogos, laboratorio y axe WCAG 2.1 AA.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
