/** Pruebas sin dependencias: lógica real de app.js con un DOM mínimo controlado. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

function run(language) {
const homeFile = path.resolve(__dirname, language === 'es' ? '../index.html' : '../en/index.html');
const html = fs.readFileSync(homeFile, 'utf8');
const script = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)].map(([, name, , value]) => [name, value]));
let document;
class FakeNode {
  constructor(id = '', attrs = {}) {
    this.id = id;
    this.value = attrs.value || '';
    this.defaultValue = this.value;
    this.min = attrs.min || '';
    this.max = attrs.max || '';
    this.textContent = '';
    this.innerHTML = '';
    this.events = {};
    this.attributes = { ...attrs };
    this.children = [];
    this.hidden = ['email-link', 'linkedin-link'].includes(id);
    this.dataset = {};
    this.open = false;
    this.classes = new Set((attrs.class || '').split(' ').filter(Boolean));
    this.classList = {
      toggle: (token, force) => {
        const enabled = force === undefined ? !this.classes.has(token) : Boolean(force);
        if (enabled) this.classes.add(token); else this.classes.delete(token);
        return enabled;
      },
      add: (...tokens) => tokens.forEach(token => this.classes.add(token)),
      remove: (...tokens) => tokens.forEach(token => this.classes.delete(token)),
      contains: token => this.classes.has(token)
    };
  }
  addEventListener(name, callback) { (this.events[name] ||= []).push(callback); }
  dispatch(name, event = {}) {
    const dispatched = { target: this, preventDefault() { this.defaultPrevented = true; }, ...event };
    for (const callback of this.events[name] || []) callback(dispatched);
    return dispatched;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  append(...elements) { this.children.push(...elements); }
  replaceChildren(...elements) { this.children = elements; }
  querySelectorAll(selector) { return selector === 'a' ? this.children : []; }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatch('close'); }
  focus() { document.activeElement = this; }
}
const nodes = new Map([...html.matchAll(/<[a-z][^>]*\bid=["'][^"']+["'][^>]*>/gi)]
  .map(([tag]) => { const attrs = attributes(tag); return [attrs.id, new FakeNode(attrs.id, attrs)]; }));
const get = id => { assert(nodes.has(id), 'ID solicitado por JavaScript no existe en HTML: ' + id); return nodes.get(id); };
function matchingNodes(attribute) {
  return [...html.matchAll(/<[a-z][^>]*>/gi)].map(([tag]) => attributes(tag)).filter(attrs => attribute in attrs)
    .map(attrs => {
      const node = new FakeNode(attrs.id, attrs);
      for (const [name, value] of Object.entries(attrs)) if (name.startsWith('data-')) node.dataset[name.slice(5)] = value;
      return node;
    });
}
const filters = matchingNodes('data-filter');
const cards = matchingNodes('data-category');
const projectButtons = matchingNodes('data-project');
const navLink = new FakeNode('nav-link');
get('primary-nav').children = [navLink];
document = {
  documentElement: { lang: language },
  activeElement: null,
  getElementById: get,
  querySelectorAll: selector => ({ '[data-filter]': filters, '.project-card': cards, '[data-project]': projectButtons })[selector] || [],
  createElementNS: (_, name) => new FakeNode(name),
  createElement: name => new FakeNode(name),
  events: {},
  addEventListener(name, callback) { (this.events[name] ||= []).push(callback); },
  dispatch(name, event) { for (const callback of this.events[name] || []) callback(event); },
  body: new FakeNode('body')
};
const context = vm.createContext({ document, Date, Intl, console });
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../profile-data.js'), 'utf8'), context, { filename: 'profile-data.js' });
vm.runInContext(script, context, { filename: 'app.js' });

// Casos de equilibrio independientes del dibujo y de su escala normalizada.
for (const [x, shear, moment] of [[0, 54, 0], [1.5, 27, 60.75], [3, 0, 81], [6, -54, 0]]) {
  const result = context.calculateBeam(6, 18, x);
  assert.equal(result.reaction, 54);
  assert.equal(result.shear, shear);
  assert.equal(result.moment, moment);
  assert.equal(result.maxMoment, 81);
  assert.equal(result.reaction * 2, 6 * 18, 'Suma de reacciones igual a la carga total');
}
assert(Object.values(context.calculateBeam(6, 0)).every(value => value === 0), 'Sin carga, todos los esfuerzos son nulos');
for (const args of [[0, 18], [-1, 18], [6, -1], [6, 18, -1], [6, 18, 7], [NaN, 18], [6, Infinity]]) {
  assert.throws(() => context.calculateBeam(...args), { name: 'RangeError' }, 'Se rechazan parámetros físicamente inválidos');
}

function displayedValue(id) {
  const value = get(id).innerHTML.replace(/<[^>]*>/g, '').trim().split(/\s/)[0];
  return Number(language === 'es' ? value.replaceAll('.', '').replace(',', '.') : value.replaceAll(',', ''));
}
function assertLab(L, q) {
  get('span-input').value = String(L);
  get('load-input').value = String(q);
  get('span-input').dispatch('input');
  assert(Math.abs(displayedValue('reaction-value') - q * L / 2) <= .051, 'Equilibrio de reacciones: L=' + L + ', q=' + q);
  assert(Math.abs(displayedValue('moment-value') - q * L * L / 8) <= .051, 'Momento máximo: L=' + L + ', q=' + q);
  for (const id of ['shear-path', 'moment-path']) {
    const points = get(id).getAttribute('points').split(' ').map(pair => pair.split(',').map(Number));
    assert(points.length >= 3, 'El diagrama necesita extremos y puntos interiores');
    assert(points.flat().every(Number.isFinite), 'Diagrama con valores no finitos: ' + id);
    const first = points[0], last = points.at(-1), middle = points[Math.floor(points.length / 2)];
    assert(first[0] < middle[0] && middle[0] < last[0], 'Abscisas ordenadas: ' + id);
    if (id === 'shear-path') {
      assert(first[1] < middle[1] && middle[1] < last[1], 'Cortante monótono');
      assert(Math.abs((first[1] + last[1]) / 2 - middle[1]) < .02, 'Cortante nulo a mitad de luz');
    } else {
      assert.equal(first[1], last[1], 'Momento nulo en ambos apoyos');
      assert(middle[1] > first[1], 'Momento positivo máximo en el centro');
      for (let i = 0; i < points.length; i++) assert(Math.abs(points[i][1] - points[points.length - 1 - i][1]) < .02, 'Parábola simétrica');
    }
  }
}
assert.equal(displayedValue('reaction-value'), 54);
assert.equal(displayedValue('moment-value'), 81);
let beamCases = 0;
for (let L = Number(get('span-input').min); L <= Number(get('span-input').max); L += Number(get('span-input').getAttribute('step'))) {
  for (let q = Number(get('load-input').min); q <= Number(get('load-input').max); q += Number(get('load-input').getAttribute('step'))) {
    assertLab(L, q); beamCases++;
  }
}
get('lab-reset').dispatch('click');
assert.equal(get('span-input').value, '6');
assert.equal(get('load-input').value, '18');
assert.equal(displayedValue('reaction-value'), 54);
assert.equal(displayedValue('moment-value'), 81);
assert(get('span-input').getAttribute('aria-valuetext'), 'Luz accesible con unidades');
assert(get('load-input').getAttribute('aria-valuetext'), 'Carga accesible con unidades');
// Cada filtro debe ocultar exclusivamente las categorías ajenas y conservar un único botón activo.
for (const filter of [...filters, ...filters.slice().reverse()]) {
  filter.dispatch('click');
  assert.equal(filters.filter(button => button.getAttribute('aria-pressed') === 'true').length, 1);
  assert.equal(filters.filter(button => button.classList.contains('active')).length, 1);
  assert.equal(filter.getAttribute('aria-pressed'), 'true');
  for (const card of cards) assert.equal(card.hidden, filter.dataset.filter !== 'todos' && !card.dataset.category.split(' ').includes(filter.dataset.filter));
}
filters.find(button => button.dataset.filter === 'todos').dispatch('click');

for (const trigger of projectButtons) {
  trigger.focus();
  trigger.dispatch('click');
  assert.equal(get('project-dialog').open, true);
  assert.equal(document.activeElement, get('dialog-close'), 'Foco inicial del diálogo');
  assert(get('dialog-title').textContent.length > 10);
  assert(get('dialog-facts').children.length > 0);
  assert(fs.existsSync(path.resolve(path.dirname(homeFile), get('dialog-case-link').href)), 'Ficha accesible desde el diálogo');
  assert(document.body.classList.contains('dialog-open'));
  get('dialog-close').dispatch('click');
  assert.equal(get('project-dialog').open, false);
  assert.equal(document.activeElement, trigger, 'Se restaura el foco del diálogo');
  assert(!document.body.classList.contains('dialog-open'));
}
projectButtons[0].dispatch('click');
get('project-dialog').dispatch('click', { target: get('dialog-title') });
assert.equal(get('project-dialog').open, true, 'Un clic interior no debe cerrar el diálogo');
get('project-dialog').dispatch('click');
assert.equal(get('project-dialog').open, false, 'El fondo permite cerrar el diálogo');

get('nav-toggle').dispatch('click');
assert.equal(get('nav-toggle').getAttribute('aria-expanded'), 'true');
assert(get('primary-nav').classList.contains('is-open'));
navLink.dispatch('click');
assert.equal(get('nav-toggle').getAttribute('aria-expanded'), 'false');
get('nav-toggle').dispatch('click');
document.dispatch('keydown', { key: 'Escape' });
assert.equal(get('nav-toggle').getAttribute('aria-expanded'), 'false');
assert.equal(get('nav-toggle').getAttribute('aria-label'), language === 'es' ? 'Abrir menú' : 'Open menu');
assert.equal(document.activeElement, get('nav-toggle'));
assert(!get('primary-nav').classList.contains('is-open'));
assert.equal(get('github-link').href, 'https://github.com/SergioAmbrosio714');
const profile = vm.runInContext('PROFILE', context);
assert.equal(get('email-link').hidden, !profile.email);
assert.equal(get('linkedin-link').hidden, !profile.linkedin);
if (profile.email) assert.equal(get('email-link').href, 'mailto:' + profile.email);
if (profile.linkedin) assert.equal(get('linkedin-link').href, profile.linkedin);
assert.equal(get('year').textContent, String(new Date().getFullYear()));
console.log('PASS [' + language + ']: ' + beamCases + ' combinaciones de viga; filtros, ' + projectButtons.length + ' diálogos, foco, menú y contacto.');
}
run('es');
run('en');
