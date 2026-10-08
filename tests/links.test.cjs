/** Validación sin dependencias de rutas, anclas y relaciones accesibles. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
function filesIn(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules'
      ? filesIn(path.join(dir, entry.name)) : entry.isFile() ? [path.join(dir, entry.name)] : []);
}
const files = filesIn(root);
const pages = files.filter(file => file.endsWith('.html'));
const idsByFile = new Map();
let resources = 0;
let anchors = 0;
let accessibleReferences = 0;

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)]
    .map(([, name, , value]) => [name.toLowerCase(), value]));
}
function idsIn(file) {
  if (!idsByFile.has(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const ids = [...content.matchAll(/\bid\s*=\s*(["'])(.*?)\1/g)].map(match => match[2]);
    assert.equal(ids.length, new Set(ids).size, `ID duplicado: ${file}`);
    idsByFile.set(file, new Set(ids));
  }
  return idsByFile.get(file);
}
function checkTarget(source, target) {
  if (!target || target === '#' || /^(?:https?:|mailto:|tel:|data:|\/\/)/i.test(target)) return;
  assert(!/^javascript:/i.test(target), `Enlace ejecutable: ${source}: ${target}`);
  const url = new URL(target.replaceAll('&amp;', '&'), 'https://local.test/' + path.relative(root, source).split(path.sep).join('/'));
  const linked = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  assert(linked === root || linked.startsWith(root + path.sep), `Ruta fuera del sitio: ${target}`);
  assert(fs.existsSync(linked) && fs.statSync(linked).isFile(), `Archivo faltante: ${source} → ${target}`);
  // Windows tolera errores de mayúsculas que rompen los enlaces en GitHub Pages.
  let directory = root;
  for (const segment of path.relative(root, linked).split(path.sep)) {
    assert(fs.readdirSync(directory).includes(segment), `Mayúsculas incorrectas: ${source} → ${target}`);
    directory = path.join(directory, segment);
  }
  resources++;
  if (url.hash && /\.(?:html|svg)$/.test(linked)) {
    assert(idsIn(linked).has(decodeURIComponent(url.hash.slice(1))), `Ancla faltante: ${source} → ${target}`);
    anchors++;
  }
}

for (const file of pages) {
  const content = fs.readFileSync(file, 'utf8');
  assert(!content.includes('\uFFFD'), `Texto con errores de codificación: ${file}`);
  assert.match(content, /<html\b[^>]*\blang=["']es["']/i, `Idioma español ausente: ${file}`);
  assert.equal([...content.matchAll(/<h1\b/gi)].length, 1, `Se espera un título h1: ${file}`);
  const ids = idsIn(file);
  for (const [tag] of content.matchAll(/<[a-z][^>]*>/gi)) {
    const attrs = attributes(tag);
    for (const kind of ['href', 'src']) if (attrs[kind]) checkTarget(file, attrs[kind]);
    if (attrs.property === 'og:image') checkTarget(file, attrs.content);
    if (/^<img\b/i.test(tag)) assert('alt' in attrs, `Imagen sin alt: ${file}: ${attrs.src}`);
    for (const kind of ['aria-labelledby', 'aria-describedby', 'aria-controls']) {
      for (const id of (attrs[kind] || '').split(/\s+/).filter(Boolean)) {
        assert(ids.has(id), `Referencia ${kind} inexistente: ${file}: ${id}`);
        accessibleReferences++;
      }
    }
    if (/^<(?:label|output)\b/i.test(tag) && attrs.for) {
      for (const id of attrs.for.split(/\s+/)) assert(ids.has(id), `Control inexistente: ${file}: ${id}`);
    }
    if (attrs.target === '_blank') assert(/\bnoopener\b/.test(attrs.rel || ''), `Enlace externo sin noopener: ${file}`);
  }
}
for (const file of files.filter(file => file.endsWith('.css'))) {
  const css = fs.readFileSync(file, 'utf8');
  for (const [, , target] of css.matchAll(/url\(\s*(["']?)([^)'"\s]+)\1\s*\)/g)) checkTarget(file, target);
}
const js = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
for (const [, , target] of js.matchAll(/\bdoc\s*:\s*(["'])(casos\/[^"']+)\1/g)) {
  checkTarget(path.join(root, 'index.html'), target);
}
console.log(`PASS: ${pages.length} páginas HTML; ${resources} rutas, ${anchors} anclas y ${accessibleReferences} referencias ARIA válidas.`);
