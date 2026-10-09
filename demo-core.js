/* Browser implementation of the documented Python demonstration contracts.
 * Pure functions; no DOM, requests, storage or commercial-software connection.
 * tests/demo-core.test.cjs compares these outputs with the executable Python.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StructuralDemos = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_BYTES = 2 * 1024 * 1024, MAX_ROWS = 5000;
  const STOREY_COLUMNS = ['case', 'level', 'elevation', 'displacement', 'elevation_unit', 'displacement_unit'];
  const CANTILEVER_COLUMNS = ['scenario', 'length_m', 'width_m', 'depth_m', 'elastic_modulus_pa', 'tip_load_n', 'reference_stress_pa'];
  class ValidationError extends Error {
    constructor(code, detail = '') { super(detail || code); this.name = 'ValidationError'; this.code = code; }
  }
  const fail = (code, detail) => { throw new ValidationError(code, detail); };
  function identifier(value) {
    if (typeof value !== 'string' || /[\x00-\x1f]/.test(value)) fail('invalid_identifier');
    value = value.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9_. /()+-]{0,63}$/.test(value)) fail('invalid_identifier');
    return value;
  }
  function number(value, positive = false) {
    if (typeof value === 'boolean' || value === null || value === undefined) fail('invalid_number');
    if (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) fail('invalid_number');
    const result = Number(value);
    if (!Number.isFinite(result) || (positive && result <= 0)) fail('invalid_number');
    return result;
  }
  function finite(value) {
    if (typeof value === 'number' && !Number.isFinite(value)) fail('numeric_range');
    if (value && typeof value === 'object') Object.values(value).forEach(finite);
    return value;
  }
  function parseCSV(text, columns) {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_BYTES) fail('file_limit');
    text = text.replace(/^\uFEFF+/, '');
    const records = []; let row = [], field = '', quoted = false, closed = false, active = false;
    function finishRow() {
      row.push(field);
      if (active || row.length > 1 || field !== '') records.push(row);
      row = []; field = ''; closed = false; active = false;
      if (records.length > MAX_ROWS + 1) fail('row_limit');
    }
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (char === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; }
        } else field += char;
      } else if (char === ',') { row.push(field); field = ''; closed = false; active = true; }
      else if (char === '\r' || char === '\n') { if (char === '\r' && text[i + 1] === '\n') i++; finishRow(); }
      else if (char === '"' && field === '' && !closed) { quoted = true; active = true; }
      else { if (closed) fail('invalid_csv'); field += char; active = true; }
    }
    if (quoted) fail('invalid_csv');
    if (active || row.length || field) finishRow();
    const header = records.shift();
    if (!header || header.length !== columns.length || new Set(header).size !== columns.length || columns.some(key => !header.includes(key))) fail('invalid_csv', columns.join(','));
    if (!records.length) fail('empty_data');
    return records.map(values => {
      if (values.length !== header.length || values.some(value => !value.trim())) fail('missing_field');
      return Object.fromEntries(header.map((key, index) => [key, values[index]]));
    });
  }
  function sameFields(row, columns) { if (Object.keys(row).length !== columns.length || columns.some(key => !Object.hasOwn(row, key))) fail('invalid_csv'); }
  function length(value, unit) {
    const units = { m: 1, cm: .01, mm: .001 };
    if (typeof unit !== 'string' || !Object.hasOwn(units, unit.trim())) fail('unsupported_unit');
    return number(value) * units[unit.trim()];
  }
  function processRows(rows, referenceCase = null) {
    if (!rows.length) fail('insufficient_levels');
    const grouped = new Map();
    for (const row of rows) {
      sameFields(row, STOREY_COLUMNS);
      const name = identifier(row.case), level = identifier(row.level);
      const elevation = length(row.elevation, row.elevation_unit), displacement = length(row.displacement, row.displacement_unit);
      if (!grouped.has(name)) grouped.set(name, new Map());
      if (grouped.get(name).has(level)) fail('duplicate_case_level', name + '/' + level);
      grouped.get(name).set(level, [elevation, displacement]);
    }
    const names = [...grouped.keys()].sort();
    referenceCase = referenceCase === null ? names[0] : identifier(referenceCase);
    if (!grouped.has(referenceCase)) fail('invalid_reference');
    const reference = grouped.get(referenceCase);
    if (reference.size < 2) fail('insufficient_levels');
    const order = [...reference.keys()].sort((a, b) => reference.get(a)[0] - reference.get(b)[0]);
    for (let i = 1; i < order.length; i++) if (reference.get(order[i])[0] <= reference.get(order[i - 1])[0]) fail('duplicate_elevation');
    const cases = names.map(name => {
      const values = grouped.get(name);
      if (values.size !== reference.size || order.some(level => !values.has(level))) fail('incompatible_profile');
      if (new Set([...values.values()].map(value => value[0])).size !== values.size) fail('duplicate_elevation');
      let previousElevation = null, previousDisplacement = null;
      const points = order.map(level => {
        let [elevation, displacement] = values.get(level);
        const target = reference.get(level)[0];
        if (Math.abs(elevation - target) > Math.max(1e-9, 1e-9 * Math.max(Math.abs(elevation), Math.abs(target)))) fail('incompatible_profile');
        elevation = target;
        const height = previousElevation === null ? null : elevation - previousElevation;
        const delta = previousDisplacement === null ? null : displacement - previousDisplacement;
        const point = { level, elevation_m: elevation, displacement_m: displacement, storey_height_m: height, interstorey_displacement_m: delta, drift_ratio: height === null ? null : delta / height, difference_from_reference_m: displacement - reference.get(level)[1] };
        previousElevation = elevation; previousDisplacement = displacement;
        return point;
      });
      return { case: name, max_abs_displacement_m: Math.max(...points.map(p => Math.abs(p.displacement_m))), max_abs_drift_ratio: Math.max(...points.slice(1).map(p => Math.abs(p.drift_ratio))), points };
    });
    return finite({ schema_version: 1, demo: 'storey-results', reference_case: referenceCase, level_order: order, cases });
  }
  function processCSV(text, referenceCase = null) { return processRows(parseCSV(text, STOREY_COLUMNS), referenceCase); }
  function analyzeScenario(row, samples = 21) {
    if (!Number.isInteger(samples) || samples < 2 || samples > 1001) fail('invalid_samples');
    sameFields(row, CANTILEVER_COLUMNS);
    const scenario = identifier(row.scenario);
    const data = Object.fromEntries(CANTILEVER_COLUMNS.slice(1).map(key => [key, number(row[key], key !== 'tip_load_n')]));
    const { length_m: L, width_m: b, depth_m: h, elastic_modulus_pa: E, tip_load_n: P, reference_stress_pa: reference } = data;
    const area = b * h, inertia = b * h ** 3 / 12, rigidity = E * inertia;
    if (![area, inertia, rigidity, 6 * rigidity].every(value => Number.isFinite(value) && value > 0)) fail('numeric_range');
    const points = Array.from({ length: samples }, (_, index) => {
      const x = L * (index / (samples - 1)), moment = P * (L - x);
      return { x_m: x, shear_n: P, moment_nm: moment, displacement_m: P * x ** 2 * (3 * L - x) / (6 * rigidity), rotation_rad: P * x * (2 * L - x) / (2 * rigidity), extreme_fibre_stress_pa: moment * (h / 2) / inertia };
    });
    const stress = Math.abs(P * L) * (h / 2) / inertia;
    return finite({ scenario, input: data, section: { area_m2: area, second_moment_m4: inertia }, summary: { reaction_force_n: -P, reaction_moment_nm: -P * L, tip_displacement_m: P * L ** 3 / (3 * rigidity), tip_rotation_rad: P * L ** 2 / (2 * rigidity), max_abs_bending_stress_pa: stress, stress_reference_ratio: stress / reference }, points });
  }
  function analyzeRows(rows, samples = 21) {
    if (!rows.length) fail('empty_data');
    const identifiers = new Set();
    const scenarios = rows.map(row => {
      const scenario = analyzeScenario(row, samples);
      if (identifiers.has(scenario.scenario)) fail('duplicate_scenario');
      identifiers.add(scenario.scenario); return scenario;
    });
    return { schema_version: 1, demo: 'cantilever-tip-load', samples, scenarios };
  }
  function analyzeCSV(text, samples = 21) { return analyzeRows(parseCSV(text, CANTILEVER_COLUMNS), samples); }
  function csvText(columns, rows) {
    const cell = value => {
      const text = value === null || value === undefined ? '' : String(value);
      return /[",\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
    };
    return columns.join(',') + '\n' + rows.map(row => columns.map(key => cell(row[key])).join(',')).join('\n') + '\n';
  }
  function exportCSV(result) {
    if (result.demo === 'storey-results') {
      const columns = ['case', 'level', 'elevation_m', 'displacement_m', 'storey_height_m', 'interstorey_displacement_m', 'drift_ratio', 'reference_case', 'difference_from_reference_m'];
      return csvText(columns, result.cases.flatMap(c => c.points.map(point => ({ case: c.case, reference_case: result.reference_case, ...point }))));
    }
    return csvText(['scenario', 'x_m', 'shear_n', 'moment_nm', 'displacement_m', 'rotation_rad', 'extreme_fibre_stress_pa'], result.scenarios.flatMap(s => s.points.map(point => ({ scenario: s.scenario, ...point }))));
  }
  return { MAX_BYTES, MAX_ROWS, ValidationError, STOREY_COLUMNS, CANTILEVER_COLUMNS, parseCSV, processRows, processCSV, analyzeRows, analyzeScenario, analyzeCSV, exportCSV };
});
