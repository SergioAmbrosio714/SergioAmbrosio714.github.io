/* Original conceptual steel frame. Orthographic Canvas 2D renderer; no libraries,
 * analysis data, automatic rotation, textures, or external requests. */
(() => {
  'use strict';
  const canvas = document.getElementById('structural-model');
  if (!canvas || !canvas.closest('.hero-model')) return;
  const host = canvas.closest('.hero-model');
  let ctx;
  try { ctx = canvas.getContext('2d', { alpha: false }); } catch (_) { return; }
  if (!ctx) return;

  const add = (a, b) => a.map((v, i) => v + b[i]);
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const mul = (a, s) => a.map(v => v * s);
  const dot = (a, b) => a.reduce((v, n, i) => v + n * b[i], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = a => mul(a, 1 / (Math.hypot(...a) || 1));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const faces = [];
  const steel = [103, 126, 136];
  const accent = [69, 103, 117];
  const paleSteel = [144, 160, 166];
  const concrete = [190, 197, 192];
  const darkSteel = [77, 98, 108];
  const light = unit([-0.45, -0.35, 0.95]);

  function face(points, material, edge = true) {
    const normal = unit(cross(sub(points[1], points[0]), sub(points[2], points[0])));
    const center = mul(points.reduce((sum, point) => add(sum, point), [0, 0, 0]), 1 / points.length);
    const illumination = 0.72 + 0.30 * Math.max(0, dot(normal, light));
    const fill = `rgb(${material.map(c => Math.round(clamp(c * illumination, 0, 255))).join(',')})`;
    faces.push({ points, normal, center, fill, edge });
  }

  // An oriented rectangular solid. u and v describe its cross-section.
  function prism(a, b, width, height, material, u, v) {
    const direction = unit(sub(b, a));
    if (!v) v = Math.abs(direction[2]) > 0.95 ? [0, 1, 0] : unit(sub([0, 0, 1], mul(direction, direction[2])));
    if (!u) u = unit(cross(v, direction));
    const points = [a, b].flatMap(end => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => add(add(end, mul(u, i * width / 2)), mul(v, j * height / 2))));
    // Keep the local basis right-handed so face normals point outward.
    const loops = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    loops.forEach(indices => face(indices.map(i => points[i]), material));
  }

  function block(x, y, z, width, depth, height, material) {
    prism([x, y, z], [x, y, z + height], width, depth, material, [1, 0, 0], [0, 1, 0]);
  }

  function member(a, b, width = 0.29, depth = 0.42, material = steel) {
    const direction = unit(sub(b, a));
    const v = Math.abs(direction[2]) > 0.95 ? [0, 1, 0] : unit(sub([0, 0, 1], mul(direction, direction[2])));
    const u = unit(cross(v, direction));
    const flange = 0.045;
    for (const sign of [-1, 1]) {
      const shift = mul(v, sign * (depth - flange) / 2);
      prism(add(a, shift), add(b, shift), width, flange, material, u, v);
    }
    prism(a, b, 0.037, depth - 2 * flange, material, u, v);
  }

  function cylinder(x, y, z, radius, height, material, segments = 8) {
    const bottom = Array.from({ length: segments }, (_, i) => [x + radius * Math.cos(i * 2 * Math.PI / segments), y + radius * Math.sin(i * 2 * Math.PI / segments), z]);
    const top = bottom.map(p => add(p, [0, 0, height]));
    face(top, material);
    for (let i = 0; i < segments; i++) face([bottom[i], bottom[(i + 1) % segments], top[(i + 1) % segments], top[i]], material, false);
  }

  function rail(a, b) { prism(a, b, 0.045, 0.045, paleSteel); }

  const gridX = [-6, -2, 2, 6];
  const gridY = [-3, 3];
  const base = 0.82;
  const levels = [4.35, 7.85];

  // Individual concrete footings, raised pedestals, base plates and anchor heads.
  for (const x of gridX) for (const y of gridY) {
    block(x, y, 0, 1.45, 1.45, 0.34, concrete);
    block(x, y, 0.34, 0.75, 0.75, 0.42, [205, 210, 205]);
    block(x, y, 0.76, 0.65, 0.65, 0.06, darkSteel);
    for (const bx of [-0.255, 0.255]) for (const by of [-0.255, 0.255]) cylinder(x + bx, y + by, 0.82, 0.035, 0.07, [175, 184, 183]);
    [base, ...levels].slice(0, -1).forEach((z, i) => member([x, y, z], [x, y, levels[i]], 0.36, 0.40, y === 3 ? accent : steel));
  }

  // Primary beams meet columns; joists support two open industrial platforms.
  for (const z of levels) {
    for (const y of gridY) for (let i = 0; i < gridX.length - 1; i++) member([gridX[i], y, z], [gridX[i + 1], y, z], 0.30, 0.46);
    for (const x of gridX) member([x, -3, z], [x, 3, z], 0.28, 0.40);
    for (const x of [-4, 4]) member([x, -3, z - 0.015], [x, 3, z - 0.015], 0.21, 0.30, paleSteel);
    for (const y of [-1.8, 1.8]) member([-2, y, z], [2, y, z], 0.18, 0.26, paleSteel);

    // Thin deck panels leave an equipment opening in the center bay.
    for (const x of [-4, 4]) block(x, 0, z + 0.23, 3.86, 5.90, 0.07, [158, 174, 178]);
    block(0, -2.37, z + 0.23, 3.85, 1.12, 0.07, [158, 174, 178]);
    block(0, 2.37, z + 0.23, 3.85, 1.12, 0.07, [158, 174, 178]);

    // Perimeter guardrails, interrupted at the stair landing on the first level.
    const deckZ = z + 0.30;
    for (const y of [-3, 3]) for (let i = 0; i < gridX.length - 1; i++) {
      const stairAccess = z === levels[0] && y === -3 && i === 2;
      const endX = stairAccess ? 5.5 : gridX[i + 1];
      for (const h of [0.54, 1.02]) rail([gridX[i], y, deckZ + h], [endX, y, deckZ + h]);
      const posts = [gridX[i], (gridX[i] + endX) / 2, ...(stairAccess ? [endX] : [])];
      for (const x of posts) rail([x, y, deckZ], [x, y, deckZ + 1.02]);
    }
    for (const x of [-6, 6]) {
      for (const h of [0.54, 1.02]) rail([x, -3, deckZ + h], [x, 3, deckZ + h]);
      for (const y of [-3, 0, 3]) rail([x, y, deckZ], [x, y, deckZ + 1.02]);
    }
    // The central opening is bounded by rails on the platform edges.
    for (const h of [0.54, 1.02]) {
      for (const x of [-2, 2]) rail([x, -1.8, deckZ + h], [x, 1.8, deckZ + h]);
      for (const y of [-1.8, 1.8]) rail([-2, y, deckZ + h], [2, y, deckZ + h]);
    }
    for (const x of [-2, 2]) for (const y of [-1.8, 0, 1.8]) rail([x, y, deckZ], [x, y, deckZ + 1.02]);
  }

  // X bracing is confined to selected bays: no deformation or analysis colors.
  for (const [lo, hi] of [[base, levels[0]], [levels[0], levels[1]]]) {
    for (const y of [-3, 3]) {
      prism([-5.83, y, lo + 0.12], [-2.17, y, hi - 0.12], 0.11, 0.11, darkSteel);
      prism([-2.17, y + 0.09, lo + 0.12], [-5.83, y + 0.09, hi - 0.12], 0.11, 0.11, steel);
      for (const x of [-6, -2]) for (const z of [lo + 0.09, hi - 0.09]) block(x, y, z - 0.13, 0.32, 0.055, 0.26, accent);
    }
    for (const x of [-6, 6]) {
      prism([x, -2.83, lo + 0.12], [x, 2.83, hi - 0.12], 0.12, 0.12, darkSteel);
      prism([x + 0.08, 2.83, lo + 0.12], [x + 0.08, -2.83, hi - 0.12], 0.12, 0.12, steel);
    }
  }

  // Access stair with separate treads and two stringers, independent of the frame.
  const stairStart = [-1.2, -4.0, 0.36];
  const stairEnd = [6.0, -4.0, levels[0] + 0.30];
  block(-1.2, -4.0, 0, 1.15, 1.3, 0.24, concrete);
  for (const offset of [-0.48, 0.48]) {
    member(add(stairStart, [0, offset, -0.11]), add(stairEnd, [0, offset, -0.11]), 0.10, 0.22, darkSteel);
    rail(add(stairStart, [0, offset, 0.95]), add(stairEnd, [0, offset, 0.95]));
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const p = add(stairStart, mul(sub(stairEnd, stairStart), t));
      rail(add(p, [0, offset, 0]), add(p, [0, offset, 0.95]));
    }
  }
  for (let step = 0; step <= 20; step++) {
    const p = add(stairStart, mul(sub(stairEnd, stairStart), step / 20));
    block(p[0], p[1], p[2], 0.33, 0.91, 0.055, paleSteel);
  }
  block(6, -3.52, levels[0] + 0.24, 0.75, 1.01, 0.06, paleSteel);

  const views = {
    iso: { yaw: -2.47, pitch: 0.43, label: 'Vista axonométrica' },
    front: { yaw: 0, pitch: 0, label: 'Elevación frontal' },
    side: { yaw: Math.PI / 2, pitch: 0, label: 'Elevación lateral' }
  };
  let camera = { ...views.iso };
  let pendingFrame = 0;
  let pointer = null;
  let ready = false;
  canvas.style.touchAction = 'pan-y';

  function render() {
    pendingFrame = 0;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width < 2 || bounds.height < 2) return;
    const width = bounds.width;
    const height = bounds.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#eef1f1';
    ctx.fillRect(0, 0, width, height);
    const cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw);
    const cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
    const eye = [sy * cp, cy * cp, sp];
    const raw = p => [p[0] * cy - p[1] * sy, (p[0] * sy + p[1] * cy) * sp - p[2] * cp];
    const points = faces.flatMap(item => item.points).map(raw);
    const minX = Math.min(...points.map(p => p[0]));
    const maxX = Math.max(...points.map(p => p[0]));
    const minY = Math.min(...points.map(p => p[1]));
    const maxY = Math.max(...points.map(p => p[1]));
    const scale = Math.min(width * 0.84 / (maxX - minX), height * 0.80 / (maxY - minY));
    const centerX = (maxX + minX) / 2;
    const centerY = (maxY + minY) / 2;
    const project = p => { const q = raw(p); return [(q[0] - centerX) * scale + width * 0.50, (q[1] - centerY) * scale + height * 0.47]; };

    function path(vertices) {
      ctx.beginPath();
      vertices.forEach((point, i) => { const p = project(point); if (i === 0) ctx.moveTo(...p); else ctx.lineTo(...p); });
    }

    // Restrained ground grid and soft contact shadows convey depth without a dashboard.
    if (camera.pitch > 0.04) {
      ctx.strokeStyle = '#dce3e2';
      ctx.lineWidth = 0.6;
      for (let x = -8; x <= 8; x += 2) { path([[x, -5.7, -0.03], [x, 5, -0.03]]); ctx.stroke(); }
      for (let y = -5; y <= 5; y += 2) { path([[-8, y, -0.03], [8, y, -0.03]]); ctx.stroke(); }
      ctx.save();
      ctx.fillStyle = 'rgba(42,65,71,.075)';
      ctx.shadowColor = 'rgba(42,65,71,.13)';
      ctx.shadowBlur = 12 * (width / 900);
      for (const x of gridX) for (const y of gridY) { path([[x - 0.8, y - 0.8, 0], [x + 1.25, y - 0.8, 0], [x + 1.25, y + 1.05, 0], [x - 0.8, y + 1.05, 0]]); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }

    const visible = faces.filter(item => dot(item.normal, eye) > 0.0001).sort((a, b) => dot(a.center, eye) - dot(b.center, eye));
    ctx.lineJoin = 'round';
    for (const item of visible) {
      path(item.points);
      ctx.closePath();
      ctx.fillStyle = item.fill;
      ctx.fill();
      if (item.edge) { ctx.strokeStyle = 'rgba(42,60,66,.18)'; ctx.lineWidth = 0.45; ctx.stroke(); }
    }

    // Small orientation triad: navigation reference only, never analysis results.
    const axisOrigin = [width - Math.max(35, width * 0.07), height - Math.max(34, height * 0.065)];
    const axisSize = clamp(width * 0.045, 16, 32);
    const axes = [[1, 0, 0, 'X'], [0, 1, 0, 'Y'], [0, 0, 1, 'Z']];
    ctx.font = `${clamp(width * 0.014, 10, 12)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const axis of axes) {
      const p = raw(axis);
      if (Math.hypot(...p) < 0.1) continue;
      const end = [axisOrigin[0] + p[0] * axisSize, axisOrigin[1] + p[1] * axisSize];
      ctx.beginPath(); ctx.moveTo(...axisOrigin); ctx.lineTo(...end);
      ctx.strokeStyle = axis[3] === 'Z' ? '#456570' : '#94a5a9'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#526b74'; ctx.fillText(axis[3], end[0] + p[0] * 9, end[1] + p[1] * 9);
    }
    if (!ready) { host.classList.add('is-ready'); ready = true; }
  }

  function schedule() {
    if (!pendingFrame) pendingFrame = window.requestAnimationFrame(() => {
      try { render(); } catch (_) {
        host.classList.remove('is-ready');
        ready = false;
        pendingFrame = 0;
      }
    });
  }

  const buttons = [...document.querySelectorAll('[data-model-view]')];
  function selectView(name) {
    if (!views[name]) return;
    camera = { ...views[name] };
    host.dataset.view = name;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.modelView === name)));
    canvas.setAttribute('aria-label', `${camera.label} de una estructura industrial conceptual de acero con plataformas, arriostramientos y fundaciones de concreto. Sin resultados de cálculo.`);
    schedule();
  }
  buttons.forEach(button => button.addEventListener('click', () => selectView(button.dataset.modelView)));
  const reset = document.getElementById('model-reset');
  if (reset) reset.addEventListener('click', () => selectView('iso'));

  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: camera.yaw, pitch: camera.pitch, touch: event.pointerType === 'touch', active: false };
    if (!pointer.touch) canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (!pointer.active) {
      if (Math.hypot(dx, dy) < 6) return;
      if (pointer.touch && Math.abs(dy) >= Math.abs(dx)) return;
      pointer.active = true;
      canvas.setPointerCapture(event.pointerId);
      host.classList.add('is-dragging');
      host.dataset.view = 'custom';
      buttons.forEach(button => button.setAttribute('aria-pressed', 'false'));
      canvas.setAttribute('aria-label', 'Vista girada de una estructura industrial conceptual de acero y concreto. Sin resultados de cálculo.');
    }
    camera.yaw = pointer.yaw + dx * 0.008;
    camera.pitch = clamp(pointer.pitch + (pointer.touch ? 0 : dy * 0.005), 0, 0.95);
    schedule();
  });
  function release(event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    pointer = null;
    host.classList.remove('is-dragging');
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);

  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(canvas);
  else window.addEventListener('resize', schedule, { passive: true });
  selectView('iso');
})();
