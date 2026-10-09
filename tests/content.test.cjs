/** Content, provenance, bilingual SEO and basic HTML integrity; no dependencies. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const data = name => JSON.parse(read('data/' + name + '.json'));
const profile = data('profile');
const collections = { proyectos: data('projects'), investigacion: data('research'), notas: data('insights') };
const origin = 'https://sergioambrosio714.github.io';
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)].map(([, key, , value]) => [key, value]));
function list(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || ['node_modules', 'templates', '__pycache__'].includes(entry.name)) return [];
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? list(file) : file.endsWith('.html') ? [file] : [];
  });
}
function bilingual(value, label) {
  for (const lang of ['es', 'en']) assert(typeof value?.[lang] === 'string' && value[lang].trim(), label + ': missing ' + lang);
}
function intactText(value, label, skipProse = false) {
  if (typeof value === 'string') {
    assert(!value.includes('\uFFFD'), label + ': Unicode replacement character in source data');
    if (!skipProse) {
      const prose = value.replace(/https?:\/\/\S+/g, '').replace(/```[\s\S]*?```|`[^`]*`/g, '');
      assert(!/(?:\p{L}\?+\p{L}|\d\?+\d)/u.test(prose), label + ': possible text encoding loss inside a word or number');
    }
  } else if (Array.isArray(value)) value.forEach((item, index) => intactText(item, label + '[' + index + ']', skipProse));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      intactText(item, label + '.' + key, skipProse || /^(?:url|href|src|code|codeExample|equation|command|commands|formula|pattern)$/i.test(key));
    }
  }
}
// Encoding mistakes can remain valid JSON and then spread to every generated page.
for (const file of fs.readdirSync(path.join(root, 'data')).filter(name => name.endsWith('.json'))) {
  intactText(JSON.parse(read('data/' + file)), 'data/' + file);
}
function localUrl(url) {
  const parsed = new URL(url);
  assert.equal(parsed.origin, origin, 'Unexpected canonical/alternate host');
  let target = path.join(root, decodeURIComponent(parsed.pathname));
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
  assert(fs.existsSync(target), 'Missing translated/canonical page: ' + parsed.pathname);
  return target;
}
assert.equal(profile.name, 'Sergio Junior Ambrosio Camayo');
assert.match(profile.degree.es, /Ingeniero Civil titulado/);
assert(!/bachiller|bachelor|licensed|professional engineer\b|\bPE\b/i.test(JSON.stringify(profile.degree)), 'Academic degree must not imply an unsupported licence');
assert.equal(profile.github, 'https://github.com/SergioAmbrosio714');
assert(/^https:\/\/www\.linkedin\.com\/in\//.test(profile.linkedin));
assert.equal(profile.experience.length, 5);
assert.equal(profile.expertise.length, 8);
for (const field of ['degree', 'headline', 'summary']) bilingual(profile[field], field);
for (const item of profile.experience) {
  for (const field of ['role', 'period', 'description']) bilingual(item[field], item.company + '/' + field);
  for (const lang of ['es', 'en']) assert(item.responsibilities[lang].length > 0);
}
for (const item of profile.expertise) {
  for (const field of ['title', 'description', 'method']) bilingual(item[field], item.id + '/' + field);
  assert(item.tools.length > 0);
}
let articles = 0;
for (const [group, collection] of Object.entries(collections)) {
  assert.equal(new Set(collection.items.map(item => item.id)).size, collection.items.length, group + ': duplicated identifiers');
  assert.equal(new Set(collection.items.map(item => item.slug)).size, collection.items.length, group + ': duplicated routes');
  for (const item of collection.items) {
    assert(item.image && fs.existsSync(path.join(root, item.image.src)), item.id + ': illustration missing');
    for (const field of ['source', 'usage', 'caption']) bilingual(item.image[field], item.id + '/image/' + field);
    assert(item.image.software && /^\d{4}-\d{2}-\d{2}$/.test(item.image.date), item.id + ': missing provenance metadata');
    assert(item.references.length > 0, item.id + ': no source');
    const urls = item.references.filter(reference => reference.url).map(reference => reference.url);
    assert.equal(new Set(urls).size, urls.length, item.id + ': duplicate source URLs');
    for (const url of urls) assert.match(url, /^https:\/\//, item.id + ': source must use HTTPS');
    for (const lang of ['es', 'en']) {
      const localized = item[lang];
      for (const field of ['title', 'summary']) assert(localized[field]?.trim(), item.id + ': missing ' + lang + '/' + field);
      assert(localized.sections.length >= 3, item.id + ': article is incomplete');
      const output = (lang === 'en' ? 'en/' : '') + group + '/' + item.slug + '.html';
      assert(fs.existsSync(path.join(root, output)), 'Article not generated: ' + output);
      articles++;
    }
  }
}
const publications = collections.investigacion.items;
assert.equal(publications.filter(item => item.id === '17wcee').length, 1, '17WCEE title variants must be one publication');
assert.equal(publications.filter(item => item.id === 'jsie2018').length, 1, 'Institutional duplicate must be one publication');
for (const publication of publications) assert(publication.authors.some(author => /Ambrosio/i.test(author)), publication.id + ': authorship missing');
assert.equal(publications.find(item => item.id === '17wcee').year, 2021);
assert.equal(collections.proyectos.items.length, 3);
assert(collections.notas.items.length >= 6, 'At least six technical insights required');
assert(collections.notas.regulatory, 'Regulatory updates category missing');
for (const article of collections.notas.items) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(article.date), article.id + ': review date missing');
  for (const lang of ['es', 'en']) assert(article[lang].scope || article[lang].sections.some(section => /alcance|scope/i.test(section.title) && section.paragraphs?.length), article.id + ': technical scope missing');
}

const voidTags = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const files = list(root);
let indexed = 0;
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file).split(path.sep).join('/');
  assert.match(html, /<!doctype html>/i, relative + ': doctype missing');
  assert(!/\b(?:bachiller|bachelor)\b/i.test(html), relative + ': outdated academic degree');
  assert(!/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(html), relative + ': potential credential');
  assert(!/(?:file:\/\/\/|[A-Z]:[\\/]Users[\\/]|[A-Z]:[\\/]05_PROYECTOS)/i.test(html), relative + ': local filesystem information');
  assert(!/(?:\+51[\s().-]*)?9\d{2}[\s.-]\d{3}[\s.-]\d{3}\b/.test(html), relative + ': possible personal phone');
  const tokens = html.replace(/<!--[\s\S]*?-->/g, '').replace(/(<(script|style)\b[^>]*>)[\s\S]*?(<\/\2\s*>)/gi, '$1$3');
  const stack = [];
  for (const [tag, closing, name] of tokens.matchAll(/<(\/?)([a-z][\w:-]*)\b[^>]*>/gi)) {
    const key = name.toLowerCase();
    if (closing) assert.equal(stack.pop(), key, relative + ': improperly nested tag ' + tag);
    else if (!voidTags.has(key) && !/\/\s*>$/.test(tag)) stack.push(key);
  }
  assert.equal(stack.length, 0, relative + ': unclosed tags ' + stack.join(', '));
  const allTags = [...html.matchAll(/<[a-z][^>]*>/gi)].map(([tag]) => ({ tag, values: attrs(tag) }));
  const meta = allTags.filter(({ tag }) => /^<meta\b/i.test(tag)).map(item => item.values);
  assert(meta.some(item => item.name === 'description' && item.content?.length > 25), relative + ': meta description missing');
  if (meta.some(item => item.name === 'robots' && /noindex/.test(item.content))) continue;
  const links = allTags.filter(({ tag }) => /^<link\b/i.test(tag)).map(item => item.values);
  const canonical = links.filter(item => item.rel === 'canonical');
  assert.equal(canonical.length, 1, relative + ': canonical missing or duplicated');
  assert.equal(path.resolve(localUrl(canonical[0].href)), file, relative + ': canonical targets another page');
  for (const lang of ['es', 'en']) {
    const alternate = links.filter(item => item.rel === 'alternate' && item.hreflang === lang);
    assert.equal(alternate.length, 1, relative + ': missing language alternate ' + lang);
    const counterpart = localUrl(alternate[0].href);
    assert.match(fs.readFileSync(counterpart, 'utf8'), new RegExp('<html\\b[^>]*lang=["\']' + lang + '["\']'), relative + ': incorrect counterpart language');
  }
  const og = meta.find(item => item.property === 'og:image');
  assert(og && fs.existsSync(localUrl(og.content)), relative + ': social image missing');
  for (const [json] of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const text = json.replace(/^<script[^>]*>|<\/script>$/gi, '');
    JSON.parse(text);
  }
  indexed++;
}
for (const lang of ['es', 'en']) {
  const pdf = path.join(root, 'assets', 'cv-sergio-ambrosio-' + lang + '.pdf');
  assert(fs.existsSync(pdf), 'Public CV missing: ' + lang);
  assert.equal(fs.readFileSync(pdf).subarray(0, 5).toString(), '%PDF-', 'Invalid CV PDF: ' + lang);
}
console.log('PASS: bilingual profile, ' + articles + ' generated articles, publication deduplication, image provenance, ' + files.length + ' HTML documents and ' + indexed + ' indexed pages with SEO/alternates; public CV files present.');
