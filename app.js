/* ================== PERSONALIZACIÓN ==================
  Actualiza la identidad y los enlaces ANTES de publicar.
  No se incluyen correos, LinkedIn o certificaciones inventadas.
*/
const PROFILE = Object.freeze({
  name: 'Ambrosio',
  github: 'https://github.com/SergioAmbrosio714', // cuenta indicada por el titular
  email: '', // Ejemplo: nombre@dominio.com
  linkedin: '' // Ejemplo: https://www.linkedin.com/in/tu-usuario/
});

const PROJECTS = Object.freeze({
  cfrp: {
    number: '001 / ANÁLISIS SÍSMICO', eyebrow: 'INVESTIGACIÓN NUMÉRICA', title: 'Comportamiento sísmico de pilares reforzados con CFRP',
    intro: 'Evaluación comparativa de un pilar de concreto armado sin refuerzo (BASE) y con confinamiento mediante fibra de carbono, bajo demanda lateral cíclica.',
    tags: ['OpenSeesPy', 'Concrete04', 'CFRP', 'Comportamiento no lineal'],
    method: 'La documentación describe la calibración de un modelo de sección fibra frente a un ensayo cíclico de referencia (columna C7), la incorporación del confinamiento equivalente del núcleo y la comparación de fuerza, rigidez, deriva y energía entre BASE y CFRP. Los anexos que permiten verificar este procedimiento no están adjuntos.',
    result: 'La documentación reporta NRMSE de 7,928 %, 117/117 objetivos cíclicos completados y +12,725 % de fuerza lateral positiva a +5 % de deriva para el caso estudiado. La rigidez inicial no aumentó. Estos valores se conservan como resultados reportados; no se han adjuntado los datos ni los archivos de cálculo para reproducirlos.',
    caution: 'Estudio numérico con respaldo pendiente de incorporación. Sus indicadores no se extrapolan a otras estructuras. Las figuras son conceptuales, sin curvas de resultados simuladas.',
    doc: 'casos/01-pilares-cfrp.html'
  },
  e030: {
    number: '002 / FLUJO EN DESARROLLO', eyebrow: 'AUTOMATIZACIÓN · EN DESARROLLO', title: 'Verificación sísmica mediante ETABS, Python y Mathcad Prime',
    intro: 'Propuesta de flujo controlado para extraer información estructural, organizar los datos del modelo y producir verificaciones documentadas.',
    tags: ['ETABS API', 'Python', 'Mathcad Prime', 'E.030'],
    method: 'La arquitectura definida separa la extracción de datos del software ETABS (modo lectura), la normalización y validación en Python, el desarrollo de operaciones con Mathcad Prime y la salida documental. Se contemplan verificaciones de regularidad, derivas, peso sísmico y parámetros de diseño dentro de un alcance acotado.',
    result: 'La arquitectura y el alcance funcional están definidos; el motor y el formato final se encuentran en evolución. No se presenta todavía como software listo para certificar cumplimiento normativo.',
    caution: 'Estado: prototipo en desarrollo. La edición y vigencia normativa no se han verificado. Las referencias a la E.030 no implican validación oficial ni sustituyen la evaluación de un ingeniero responsable.',
    doc: 'casos/02-motor-e030.html'
  },
  lisp: {
    number: '003 / PRODUCCIÓN DE PLANOS', eyebrow: 'RUTINAS DESCRITAS', title: 'Rutinas AutoLISP para detalles estructurales',
    intro: 'Conjunto de automatizaciones orientadas a reducir tareas repetitivas en producción y actualización de planos de detalle.',
    tags: ['AutoCAD', 'AutoLISP', 'Detallado', 'Control gráfico'],
    method: 'Se describen comandos para secciones de vigas y columnas, distribución de estribos, armado longitudinal, placas, escaleras, cotas y geometría auxiliar, con criterios parametrizables y convenciones de capas, colores, distancias y representación.',
    result: 'La documentación describe familias de comandos para elementos estructurales. No se han adjuntado fuentes .lsp, ejemplos reproducibles ni capturas de AutoCAD; por ello no se atribuyen ahorros medidos ni validación independiente.',
    caution: 'Desarrollo descrito, pendiente de evidencia pública. Las imágenes son conceptuales y no son capturas de AutoCAD ni planos de obra ejecutada.',
    doc: 'casos/03-autolisp.html'
  },
  columnas: {
    number: '004 / INVESTIGACIÓN PROPUESTA', eyebrow: 'EN FORMULACIÓN', title: 'Respuesta de columnas reforzadas en edificios de hasta 12 pisos',
    intro: 'Estudio orientado a comparar alternativas de reforzamiento preventivo y estudiar sus efectos en indicadores sísmicos.',
    tags: ['Edificaciones', 'Evaluación sísmica', 'CFRP', 'Encamisado'],
    method: 'La propuesta plantea un conjunto manejable de modelos de columnas de concreto armado y escenarios de demanda, comparando opciones de reforzamiento local como CFRP y encamisado. Se buscará explicar tendencias de resistencia, deformabilidad y ductilidad con parámetros controlados.',
    result: 'Proyecto en etapa de delimitación. No se anuncian resultados ni mejoras cuantitativas que todavía no han sido obtenidas.',
    caution: 'Estado: propuesta de investigación. No equivale a un servicio de diagnóstico estructural ni incluye resultados validados de edificios existentes.',
    doc: 'casos/04-columnas.html'
  }
});

function initNavigation() {
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('primary-nav');
  function closeNavigation(restoreFocus = false) {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menú');
    if (restoreFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
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
    document.getElementById('filter-status').textContent = `${count} proyectos disponibles`;
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

const format = (num, decimals=1) => new Intl.NumberFormat('es-ES',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(num);
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
    span.setAttribute('aria-valuetext', `${format(L)} metros`);
    load.setAttribute('aria-valuetext', `${format(q,0)} kilonewtons por metro`);
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
