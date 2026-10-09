/* Accessible, local-only interfaces for the original portfolio demonstrations. */
(() => {
  'use strict';
  const configNode = document.getElementById('demo-config');
  if (!configNode || !globalThis.StructuralDemos) return;
  const config = JSON.parse(configNode.textContent), core = globalThis.StructuralDemos;
  const english = config.language === 'en', tr = (es, en) => english ? en : es;
  const byId = id => document.getElementById(id);
  const colors = ['#204e62', '#a35f34', '#526733', '#725b86', '#456f70', '#8c5555'];
  const format = (value, decimals = 3) => value === null ? '—' : new Intl.NumberFormat(english ? 'en-US' : 'es-PE', { maximumFractionDigits: decimals, ...(value !== 0 && (Math.abs(value) < 0.5 * 10 ** -decimals || Math.abs(value) >= 1e8) ? { notation: 'scientific' } : {}) }).format(value);
  let result = null, sourceCSV = config.sampleCSV, demonstration = true;
  const errorMessages = {
    invalid_csv: tr('Encabezados o formato CSV inválidos. Utiliza exactamente el esquema documentado.', 'Invalid CSV headers or format. Use the exact documented schema.'),
    missing_field: tr('Hay campos vacíos o un número incorrecto de columnas.', 'One or more fields are empty or a row has the wrong number of columns.'),
    empty_data: tr('El archivo no contiene filas de datos.', 'The file contains no data rows.'),
    file_limit: tr('El archivo supera el límite de 2 MiB.', 'The file exceeds the 2 MiB limit.'),
    row_limit: tr('El archivo supera el límite de 5.000 filas.', 'The file exceeds the 5,000-row limit.'),
    invalid_identifier: tr('Identificador inválido: usa 1–64 letras o números ASCII y separadores seguros; empieza por letra o número.', 'Invalid identifier: use 1–64 ASCII letters/numbers and safe separators; start with a letter or number.'),
    invalid_number: tr('Se requiere un número decimal finito. Las dimensiones, E y la tensión de referencia deben ser positivos.', 'A finite decimal number is required. Dimensions, E and reference stress must be positive.'),
    unsupported_unit: tr('Unidad incompatible. Elevación y desplazamiento admiten m, cm o mm; no se admiten unidades de fuerza ni unidades desconocidas.', 'Incompatible unit. Elevation and displacement accept m, cm or mm; force units and unknown units are not accepted.'),
    duplicate_case_level: tr('Un caso repite el mismo nivel. Cada par caso–nivel debe ser único.', 'A case repeats the same level. Every case–level pair must be unique.'),
    duplicate_elevation: tr('Dos niveles comparten elevación. Las elevaciones deben ser distintas.', 'Two levels share an elevation. Elevations must be distinct.'),
    incompatible_profile: tr('Los casos no comparten los mismos niveles y elevaciones; no es válida su comparación.', 'The cases do not share matching levels and elevations and cannot be compared.'),
    insufficient_levels: tr('Se necesitan al menos dos niveles por caso.', 'At least two levels per case are required.'),
    invalid_reference: tr('El caso de referencia no existe en el archivo.', 'The reference case is not present in the file.'),
    numeric_range: tr('El cálculo excede el rango numérico. Revisa las magnitudes y unidades.', 'The calculation exceeds the numerical range. Review magnitudes and units.'),
    duplicate_scenario: tr('Los nombres de escenario deben ser únicos.', 'Scenario names must be unique.'),
    invalid_samples: tr('El número de puntos debe estar entre 2 y 1.001.', 'The number of stations must be between 2 and 1,001.'),
    io_error: tr('No fue posible leer el archivo como texto UTF-8.', 'The file could not be read as UTF-8 text.')
  };
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function showError(error) {
    result = null;
    byId('demo-error').textContent = errorMessages[error.code] || tr('No se pudo procesar la entrada. Revisa el formato y las unidades.', 'The input could not be processed. Check its format and units.');
    byId('demo-error').hidden = false;
    byId('demo-status').textContent = '';
    byId('demo-output').hidden = true;
    if (byId('reference-case')) byId('reference-case').disabled = true;
  }
  function startOutput(value) {
    result = value; byId('demo-error').hidden = true; byId('demo-error').textContent = '';
    byId('demo-output').hidden = false;
    byId('dataset-label').textContent = demonstration ? tr('DATOS DE DEMOSTRACIÓN', 'DEMONSTRATION DATA') : tr('ARCHIVO IMPORTADO · NO VERIFICADO EXTERNAMENTE', 'IMPORTED FILE · NOT INDEPENDENTLY VERIFIED');
  }
  function metrics(items) {
    byId('demo-metrics').replaceChildren(...items.map(([label, value]) => {
      const block = element('div'); block.append(element('span', label), element('strong', value)); return block;
    }));
  }
  function table(headers, rows, caption) {
    const wrapper = byId('demo-table');
    const node = element('table'); node.append(element('caption', caption));
    const head = element('thead'), headRow = element('tr');
    headers.forEach(label => { const th = element('th', label); th.scope = 'col'; headRow.append(th); });
    head.append(headRow); node.append(head);
    const body = element('tbody');
    rows.slice(0, 200).forEach(values => { const row = element('tr'); values.forEach(value => row.append(element('td', String(value)))); body.append(row); });
    node.append(body); wrapper.replaceChildren(node);
    wrapper.tabIndex = 0; wrapper.setAttribute('role', 'region'); wrapper.setAttribute('aria-label', caption);
    if (rows.length > 200) wrapper.append(element('p', tr('Vista limitada a 200 filas. Las exportaciones incluyen todas las filas.', 'View limited to 200 rows. Exports include all rows.'), 'input-help'));
  }
  function svg(tag, attrs = {}, text) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function chart(series, xLabel, yLabel, title, downward = false) {
    const shown = series.slice(0, 12);
    const points = shown.flatMap(s => s.points);
    let minX = Math.min(0, ...points.map(p => p[0])), maxX = Math.max(0, ...points.map(p => p[0]));
    let minY = Math.min(0, ...points.map(p => p[1])), maxY = Math.max(0, ...points.map(p => p[1]));
    if (minX === maxX) maxX = minX + 1;
    if (minY === maxY) maxY = minY + 1;
    if (![minX, maxX, minY, maxY, maxX-minX, maxY-minY].every(Number.isFinite)) throw new core.ValidationError('numeric_range');
    const W = Math.max(520, Math.min(780, byId('demo-chart').clientWidth || 780)), H = 390, left = 83, right = 30, top = 32, bottom = 63;
    const px = x => left + (x - minX) / (maxX - minX) * (W - left - right);
    const py = y => downward ? top + (y - minY) / (maxY - minY) * (H - top - bottom) : H - bottom - (y - minY) / (maxY - minY) * (H - top - bottom);
    const drawing = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title, xmlns: 'http://www.w3.org/2000/svg' });
    drawing.append(svg('title', {}, title), svg('rect', { width: W, height: H, fill: '#f8faf9' }));
    for (let i = 0; i <= 4; i++) {
      const x = minX + (maxX - minX) * i / 4, y = minY + (maxY - minY) * i / 4;
      drawing.append(svg('path', { d: `M${px(x)} ${top}V${H-bottom}M${left} ${py(y)}H${W-right}`, stroke: '#d8e2e4', fill: 'none' }));
      drawing.append(svg('text', { x: px(x), y: H - bottom + 24, 'text-anchor': 'middle', fill: '#45616e', 'font-size': 12, 'font-family': 'Arial,sans-serif' }, format(x, 2)));
      drawing.append(svg('text', { x: left - 13, y: py(y) + 4, 'text-anchor': 'end', fill: '#45616e', 'font-size': 12, 'font-family': 'Arial,sans-serif' }, format(y, 3)));
    }
    shown.forEach((line, i) => {
      const color = colors[i % colors.length];
      drawing.append(svg('polyline', { points: line.points.map(p => `${px(p[0]).toFixed(3)},${py(p[1]).toFixed(3)}`).join(' '), fill: 'none', stroke: color, 'stroke-width': i === 0 ? 3 : 2, 'stroke-dasharray': i > 0 ? `${9-i%4} ${3+i%3}` : 'none' }));
      if (line.points.length <= 50) line.points.forEach(p => drawing.append(svg('circle', { cx: px(p[0]), cy: py(p[1]), r: 2.6, fill: color })));
    });
    drawing.append(svg('text', { x: (left + W - right) / 2, y: H - 14, 'text-anchor': 'middle', fill: '#254c5c', 'font-size': 13, 'font-family': 'Arial,sans-serif' }, xLabel));
    drawing.append(svg('text', { x: 17, y: (top + H - bottom) / 2, transform: `rotate(-90 17 ${(top + H - bottom) / 2})`, 'text-anchor': 'middle', fill: '#254c5c', 'font-size': 13, 'font-family': 'Arial,sans-serif' }, yLabel));
    const legend = element('ul', undefined, 'chart-legend');
    shown.forEach((line, i) => { const li = element('li', line.name); li.style.setProperty('--series-color', colors[i % colors.length]); legend.append(li); });
    byId('demo-chart').replaceChildren(drawing, legend);
    byId('demo-chart').tabIndex=0;byId('demo-chart').setAttribute('role','region');byId('demo-chart').setAttribute('aria-label',title);
    if (series.length > 12) byId('demo-chart').append(element('p', tr('El gráfico y su SVG muestran los primeros 12 casos. CSV y JSON conservan todos.', 'The plot and its SVG show the first 12 cases. CSV and JSON retain every case.'), 'input-help'));
  }
  function renderStoreys(reference = null) {
    try {
      const value = core.processCSV(sourceCSV, reference); startOutput(value);
      const select = byId('reference-case'); select.replaceChildren(...value.cases.map(c => { const option = element('option', c.case); option.value = c.case; return option; }));
      select.value = value.reference_case; select.disabled = false;
      metrics([[tr('Casos', 'Cases'), value.cases.length], [tr('Niveles por caso', 'Levels per case'), value.level_order.length], [tr('Máximo |u|', 'Maximum |u|'), format(Math.max(...value.cases.map(c => c.max_abs_displacement_m)) * 1000) + ' mm']]);
      chart(value.cases.map(c => ({ name: c.case, points: c.points.map(p => [p.displacement_m * 1000, p.elevation_m]) })), tr('Desplazamiento u / mm', 'Displacement u / mm'), tr('Elevación z / m', 'Elevation z / m'), tr('Perfiles de desplazamiento por caso y elevación', 'Displacement profiles by case and elevation'));
      byId('chart-note').textContent = tr('Las líneas conectan niveles del mismo caso. Δu/h es una deriva geométrica sin amplificación normativa.', 'Lines connect levels within the same case. Δu/h is a geometric drift without code amplification.');
      table([tr('Caso','Case'),tr('Nivel','Level'),'z / m','u / mm','Δu/h',tr('Δ respecto a referencia / mm','Δ from reference / mm')],value.cases.flatMap(c=>c.points.map(p=>[c.case,p.level,format(p.elevation_m),format(p.displacement_m*1000),format(p.drift_ratio,6),format(p.difference_from_reference_m*1000)])),tr('Resultados normalizados y comparación entre casos','Normalized results and comparison between cases'));
      byId('demo-status').textContent = tr('Datos validados y normalizados a SI. Referencia: ', 'Data validated and normalized to SI. Reference: ') + value.reference_case + '.';
    } catch (error) { showError(error); }
  }
  function renderCantilever() {
    try {
      const read = name => {
        const input = byId('param-' + name);
        if (!input.value.trim() || !input.checkValidity()) throw new core.ValidationError('invalid_number');
        return Number(input.value);
      };
      const base = { scenario: 'BASE', length_m: read('length'), width_m: read('width') / 1000, depth_m: read('depth') / 1000, elastic_modulus_pa: read('elastic') * 1e9, tip_load_n: read('load') * 1000, reference_stress_pa: read('stress') * 1e6 };
      const value = core.analyzeRows([base, { ...base, scenario: 'HALF_LOAD', tip_load_n: base.tip_load_n / 2 }, { ...base, scenario: 'DOUBLE_E', elastic_modulus_pa: base.elastic_modulus_pa * 2 }, { ...base, scenario: 'DOUBLE_DEPTH', depth_m: base.depth_m * 2 }]);
      startOutput(value); const current = value.scenarios[0];
      byId('dataset-label').textContent = tr('ESCENARIOS ANALÍTICOS · EULER–BERNOULLI', 'ANALYTICAL SCENARIOS · EULER–BERNOULLI');
      metrics([[tr('Desplazamiento extremo','Tip displacement'),format(current.summary.tip_displacement_m*1000)+' mm'],[tr('Reacción vertical','Vertical reaction'),format(current.summary.reaction_force_n/1000)+' kN'],[tr('Momento de reacción','Reaction moment'),format(current.summary.reaction_moment_nm/1000)+' kN·m']]);
      chart(value.scenarios.map(s=>({name:s.scenario,points:s.points.map(p=>[p.x_m,p.displacement_m*1000])})),tr('Distancia al empotramiento x / m','Distance from fixed end x / m'),tr('Desplazamiento v / mm','Displacement v / mm'),tr('Desplazamiento analítico de cuatro escenarios de voladizo','Analytical displacement of four cantilever scenarios'),true);
      byId('chart-note').textContent = tr('Deformación amplificada. DOUBLE_E es sensibilidad matemática, no un grado real de material. En miembros poco esbeltos la deformación por cortante puede ser relevante; este modelo no la incluye.', 'Deflection is amplified. DOUBLE_E is mathematical sensitivity, not an actual material grade. Shear deformation may matter for stocky members; this model excludes it.');
      table([tr('Escenario','Scenario'),'I / m⁴','v(L) / mm','θ(L) / rad','|σ|max / MPa','σ/σref'],value.scenarios.map(s=>[s.scenario,s.section.second_moment_m4.toExponential(4),format(s.summary.tip_displacement_m*1000,4),format(s.summary.tip_rotation_rad,6),format(s.summary.max_abs_bending_stress_pa/1e6,3),format(s.summary.stress_reference_ratio,4)]),tr('Comparación analítica; la razón de tensiones no es una verificación normativa','Analytical comparison; the stress ratio is not a code-compliance check'));
      byId('demo-status').textContent = tr('Cuatro escenarios calculados. JSON conserva parámetros y resultados; CSV contiene las estaciones de respuesta con unidades en sus encabezados.', 'Four scenarios calculated. JSON retains parameters and results; CSV contains response stations with units in its headers.');
    } catch (error) { showError(error); }
  }
  function download(content, name, type) {
    const link = element('a'); const objectURL = URL.createObjectURL(new Blob([content], { type }));
    link.href = objectURL; link.download = name; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(objectURL), 2000);
  }
  byId('export-csv').addEventListener('click',()=>{if(result)download(core.exportCSV(result),config.kind+'-processed.csv','text/csv;charset=utf-8');});
  byId('export-json').addEventListener('click',()=>{if(result)download(JSON.stringify(result,null,2)+'\n',config.kind+'-processed.json','application/json');});
  byId('export-svg').addEventListener('click',()=>{
    const drawing=byId('demo-chart').querySelector('svg');
    if(!result||!drawing)return;
    const exported=drawing.cloneNode(true), names=[...byId('demo-chart').querySelectorAll('.chart-legend li')].map(li=>li.textContent);
    const extra=names.length*24+64,width=drawing.viewBox.baseVal.width;
    exported.setAttribute('viewBox',`0 0 ${width} ${390+extra}`);
    exported.setAttribute('width',String(width));exported.setAttribute('height',String(390+extra));
    exported.append(svg('rect',{x:0,y:390,width,height:extra,fill:'#f8faf9'}));
    names.forEach((name,i)=>{
      exported.append(svg('line',{x1:30,y1:414+i*24,x2:55,y2:414+i*24,stroke:colors[i%colors.length],'stroke-width':3,'stroke-dasharray':i>0?`${9-i%4} ${3+i%3}`:'none'}));
      exported.append(svg('text',{x:68,y:418+i*24,fill:'#254c5c','font-size':12,'font-family':'Arial,sans-serif'},name));
    });
    exported.append(svg('text',{x:30,y:390+extra-16,fill:'#45616e','font-size':10,'font-family':'Arial,sans-serif'},config.kind==='storeys'?tr('Perfil geométrico · sin verificación normativa · hasta 12 casos','Geometric profile · no code-compliance check · up to 12 cases'):tr('Euler–Bernoulli · deformación amplificada · sin verificación normativa','Euler–Bernoulli · amplified deflection · no code-compliance check')));
    download(new XMLSerializer().serializeToString(exported),config.kind+'-plot.svg','image/svg+xml');
  });
  if (config.kind === 'storeys') {
    let loadGeneration=0;
    byId('results-file').addEventListener('change',async event=>{
      const generation=++loadGeneration,file=event.target.files[0];if(!file)return;
      result=null;byId('demo-output').hidden=true;byId('reference-case').disabled=true;
      byId('demo-error').hidden=true;byId('demo-status').textContent=tr('Leyendo archivo…','Reading file…');
      try{
        if(file.size>core.MAX_BYTES)throw new core.ValidationError('file_limit');
        const bytes=await file.arrayBuffer();if(generation!==loadGeneration)return;
        sourceCSV=new TextDecoder('utf-8',{fatal:true}).decode(bytes);demonstration=false;renderStoreys();
      }catch(error){if(generation===loadGeneration)showError(error instanceof core.ValidationError?error:new core.ValidationError('io_error'));}
    });
    byId('reference-case').addEventListener('change',event=>renderStoreys(event.target.value));
    byId('demo-load-example').addEventListener('click',()=>{++loadGeneration;sourceCSV=config.sampleCSV;demonstration=true;byId('results-file').value='';renderStoreys();});
    renderStoreys();
  } else {
    byId('cantilever-form').addEventListener('input',()=>{
      result=null;byId('demo-output').hidden=true;byId('demo-error').hidden=true;
      byId('demo-status').textContent=tr('Parámetros modificados: vuelve a calcular para ver y exportar resultados.','Parameters changed: calculate again to view and export results.');
    });
    byId('cantilever-form').addEventListener('submit',event=>{event.preventDefault();renderCantilever();});
    byId('demo-reset').addEventListener('click',()=>{byId('cantilever-form').reset();renderCantilever();});
    renderCantilever();
  }
})();
