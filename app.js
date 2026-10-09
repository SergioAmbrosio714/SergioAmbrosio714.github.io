/* Identity and case summaries are generated from data/. */
const language = document.documentElement?.lang === 'en' ? 'en' : 'es';
const english = language === 'en';
const PROFILE = Object.freeze(globalThis.PORTFOLIO_DATA.profile);
const PROJECTS = Object.freeze(globalThis.PORTFOLIO_DATA.projects[language]);
const menuLabel = open => english ? (open ? 'Close menu' : 'Open menu') : (open ? 'Cerrar menú' : 'Abrir menú');

function initNavigation() {
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('primary-nav');
  function closeNavigation(restoreFocus = false) {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', menuLabel(false));
    if (restoreFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', menuLabel(open));
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    closeNavigation();
  }));
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && nav.classList.contains('is-open')){
      closeNavigation(true);
    }
  });
}

function initFilters() {
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const cards = [...document.querySelectorAll('.project-card')];
  buttons.forEach(button => button.addEventListener('click', () => {
    const category = button.dataset.filter;
    buttons.forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
    cards.forEach(card => { card.hidden = category !== 'todos' && !card.dataset.category.split(' ').includes(category); });
    const count = cards.filter(card => !card.hidden).length;
    document.getElementById('filter-status').textContent = `${count} ${english ? 'projects available' : 'proyectos disponibles'}`;
  }));
}

function initProjectDialog(){
  const dialog = document.getElementById('project-dialog');
  const close = document.getElementById('dialog-close');
  const fields = {
    number: document.getElementById('dialog-number'), eyebrow: document.getElementById('dialog-eyebrow'),
    title: document.getElementById('dialog-title'), intro: document.getElementById('dialog-intro'),
    method: document.getElementById('dialog-method'), result: document.getElementById('dialog-result'),
    caution: document.getElementById('dialog-caution'), facts: document.getElementById('dialog-facts'),
    doc: document.getElementById('dialog-case-link')
  };
  let lastFocus = null;
  document.querySelectorAll('[data-project]').forEach(button => button.addEventListener('click', event => {
    if (event?.ctrlKey || event?.metaKey || event?.shiftKey || event?.altKey) return;
    if (typeof dialog.showModal !== 'function') return;
    const project = PROJECTS[button.dataset.project]; if(!project) return;
    event?.preventDefault();
    lastFocus = button;
    ['number','eyebrow','title','intro','method','result','caution'].forEach(key => {fields[key].textContent = project[key]});
    fields.facts.replaceChildren(...project.tags.map(t => {const chip=document.createElement('span');chip.textContent=t;return chip;}));
    fields.doc.href = project.doc;
    dialog.showModal();document.body.classList.add('dialog-open');close.focus();
  }));
  function dismiss(){if(dialog.open) dialog.close();}
  close.addEventListener('click', dismiss);
  dialog.addEventListener('click', e => {if(e.target === dialog) dismiss();});
  dialog.addEventListener('close', () => {document.body.classList.remove('dialog-open');lastFocus?.focus();});
}

const format = (num, decimals=1) => new Intl.NumberFormat(english ? 'en-US' : 'es-ES',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(num);
const svgNS = 'http://www.w3.org/2000/svg';
// Equilibrio de una viga biapoyada con carga uniforme. Unidades: m, kN/m, kN, kN·m.
function calculateBeam(L, q, x = L / 2) {
  if (![L, q, x].every(Number.isFinite) || L <= 0 || q < 0 || x < 0 || x > L) {
    throw new RangeError('La luz debe ser positiva, la carga no negativa y 0 ≤ x ≤ L.');
  }
  return { reaction: q * L / 2, shear: q * (L / 2 - x), moment: q * x * (L - x) / 2, maxMoment: q * L * L / 8 };
}
function initBeamLab(){
  const span = document.getElementById('span-input');
  const load = document.getElementById('load-input');
  const arrowGroup = document.getElementById('beam-load-arrows');
  function svgElement(tag, attrs){const e=document.createElementNS(svgNS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));return e;}
  for(let i=0;i<13;i++){
    const x=80+i*50;
    arrowGroup.append(svgElement('path',{d:`M${x} 51 V104`,stroke:'#7297a2','stroke-width':2.2,'marker-end':'url(#arrow)'}));
  }
  function update(){
    const L=Number(span.value),q=Number(load.value);
    const {reaction: R, maxMoment: M} = calculateBeam(L, q);
    document.getElementById('span-value').textContent=`${format(L)} m`;
    document.getElementById('load-value').textContent=`${format(q,0)} kN/m`;
    span.setAttribute('aria-valuetext', `${format(L)} ${english ? 'metres' : 'metros'}`);
    load.setAttribute('aria-valuetext', `${format(q,0)} ${english ? 'kilonewtons per metre' : 'kilonewtons por metro'}`);
    document.getElementById('reaction-value').innerHTML=`${format(R)} <small>kN</small>`;
    document.getElementById('moment-value').innerHTML=`${format(M)} <small>kN·m</small>`;
    document.getElementById('beam-l-label').textContent=`L = ${format(L)} m`;
    document.getElementById('beam-q-label').textContent=`q = ${format(q,0)} kN/m`;
    document.getElementById('shear-scale').textContent=`±${format(R)} kN`;
    document.getElementById('moment-scale').textContent=`Mmax = ${format(M)} kN·m`;
    const vx=[],mx=[];
    for(let i=0;i<=90;i++){
      const t=i/90,x=t*L,p=65+635*t;
      const {shear: V, moment: mo} = calculateBeam(L, q, x);
      vx.push([p,75-(R ? V/R : 0)*53]);
      mx.push([p,26+(M ? mo/M : 0)*102]);
    }
    const pts=arr=>arr.map(p=>p.map(n=>n.toFixed(2)).join(',')).join(' ');
    document.getElementById('shear-path').setAttribute('points',pts(vx));
    document.getElementById('shear-fill').setAttribute('d',`M65,75 L${pts(vx).replaceAll(' ', ' L')} L700,75 Z`);
    document.getElementById('moment-path').setAttribute('points',pts(mx));
    document.getElementById('moment-fill').setAttribute('d',`M65,26 L${pts(mx).replaceAll(' ', ' L')} L700,26 Z`);
  }
  span.addEventListener('input',update);load.addEventListener('input',update);update();
  document.getElementById('lab-reset').addEventListener('click', () => {
    span.value = '6'; load.value = '18'; update();
  });
}
function initContacts(){
  document.getElementById('year').textContent=String(new Date().getFullYear());
  document.getElementById('github-link').href=PROFILE.github;
  if(PROFILE.email){const a=document.getElementById('email-link');a.href=`mailto:${PROFILE.email}`;a.hidden=false;}
  if(PROFILE.linkedin){const a=document.getElementById('linkedin-link');a.href=PROFILE.linkedin;a.hidden=false;}
}
initNavigation();initFilters();initProjectDialog();initBeamLab();initContacts();
