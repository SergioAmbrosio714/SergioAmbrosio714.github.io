/** Execute Python and compare browser algorithms, validation and CSV exports. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const core = require('../demo-core.js');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const storey = read('python/examples/storey-results.csv');
const beam = read('python/examples/cantilever-scenarios.csv');
const validation = JSON.parse(read('python/fixtures/validation-cases.json'));
const failures = [];
let checks = 0, comparedNumbers = 0;
function test(name, callback) {
  try { callback(); checks++; }
  catch (error) { failures.push(name + ': ' + error.message); }
}
function close(actual, expected, label = 'result') {
  if (typeof expected === 'number') {
    assert(Number.isFinite(actual), label + ': number must be finite');
    assert(Math.abs(actual - expected) <= Math.max(1e-14, Math.abs(expected) * 1e-12), label + ': ' + actual + ' != ' + expected);
    comparedNumbers++;
  } else if (expected && typeof expected === 'object') {
    assert.equal(Array.isArray(actual), Array.isArray(expected), label + ': array/object mismatch');
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), label + ': different fields');
    for (const key of Object.keys(expected)) close(actual[key], expected[key], label + '.' + key);
  } else assert.equal(actual, expected, label);
}

const mixed = '\ufefflevel,case,displacement,elevation,displacement_unit,elevation_unit\r\nL1,B,-.003,300,m,cm\r\nL0,A,0,0,mm,m\r\nL1,A,"+2.0e0",3000,mm,mm\r\nL0,B,0,0,m,m\r\n';
const inputs = [
  { id: 'storey-example', kind: 'storey', csv: storey, reference: 'SERVICE_A' },
  { id: 'reference-B', kind: 'storey', csv: storey, reference: 'SERVICE_B' },
  { id: 'mixed-units-order-signs-bom', kind: 'storey', csv: mixed },
  { id: 'beam-example', kind: 'cantilever', csv: beam, samples: 21 },
  { id: 'beam-negative-and-zero', kind: 'cantilever', csv: beam.replace('BASE,2,0.1,0.2,200000000000,10000', 'BASE,2,0.1,0.2,200000000000,-10000').replace('HALF_LOAD,2,0.1,0.2,200000000000,5000', 'HALF_LOAD,2,0.1,0.2,200000000000,0'), samples: 101 },
  { id: 'beam-endpoints', kind: 'cantilever', csv: beam, samples: 2 },
];
const invalid = [...validation.storey.map(item => ({ ...item, kind: 'storey' })), ...validation.cantilever.map(item => ({ ...item, kind: 'cantilever' }))];
// Python runs afresh: committed fixtures alone cannot conceal implementation drift.
const script = `import csv, io, json, sys
sys.path.insert(0, sys.argv[1])
import process_results, cantilever
from _common import ValidationError
payload = json.loads(sys.stdin.buffer.read().decode('utf-8'))
output = {'valid': {}, 'invalid': {}}
for item in payload['valid']:
    module = process_results if item['kind'] == 'storey' else cantilever
    result = module.process_csv(item['csv'], item.get('reference')) if item['kind'] == 'storey' else module.analyze_csv(item['csv'], item.get('samples', 21))
    output['valid'][item['id']] = {'result': result, 'csv_rows': list(csv.DictReader(io.StringIO(module.export_csv(result))))}
for item in payload['invalid']:
    try:
        if item['kind'] == 'storey': process_results.process_csv(item['csv'], item.get('reference'))
        else: cantilever.analyze_csv(item['csv'], item.get('samples', 21))
        output['invalid'][item['kind'] + '/' + item['id']] = 'ACCEPTED'
    except ValidationError as error:
        output['invalid'][item['kind'] + '/' + item['id']] = error.code
print(json.dumps(output, allow_nan=False))
`;
const execution = spawnSync(process.env.PYTHON || 'python', ['-c', script, path.join(root, 'python')], {
  input: JSON.stringify({ valid: inputs, invalid }), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
});
assert.equal(execution.status, 0, 'Python execution failed: ' + (execution.error || execution.stderr));
const python = JSON.parse(execution.stdout);
for (const item of inputs) test(item.id + ': Python/JavaScript and CSV parity', () => {
  const actual = item.kind === 'storey' ? core.processCSV(item.csv, item.reference ?? null) : core.analyzeCSV(item.csv, item.samples);
  close(actual, python.valid[item.id].result, item.id);
  const exported = core.exportCSV(actual);
  const columns = Object.keys(python.valid[item.id].csv_rows[0]);
  // Export has intentional blank values for the initial storey; use an independent
  // plain CSV reader here rather than the stricter engineering input parser.
  const records = exported.trimEnd().split('\n').map(line => line.split(','));
  assert.deepEqual(records.shift(), columns);
  assert.equal(records.length, python.valid[item.id].csv_rows.length);
  records.forEach((record, index) => {
    assert.equal(record.length, columns.length);
    columns.forEach((key, column) => {
      const expected = python.valid[item.id].csv_rows[index][key];
      if (expected !== '' && !['case', 'level', 'reference_case', 'scenario'].includes(key)) close(Number(record[column]), Number(expected), item.id + '/CSV/' + index + '/' + key);
      else assert.equal(record[column], expected);
    });
  });
});
test('committed fixtures match executed Python', () => {
  close(python.valid['storey-example'].result, JSON.parse(read('python/fixtures/storey-results.json')));
  close(python.valid['beam-example'].result, JSON.parse(read('python/fixtures/cantilever.json')));
});
for (const item of invalid) test(item.kind + '/' + item.id + ': stable rejection', () => {
  assert.equal(python.invalid[item.kind + '/' + item.id], item.error_code, 'Python rejection changed');
  assert.throws(() => item.kind === 'storey' ? core.processCSV(item.csv, item.reference ?? null) : core.analyzeCSV(item.csv, item.samples ?? 21), error => error instanceof core.ValidationError && error.code === item.error_code, 'JavaScript must reject with ' + item.error_code);
});
test('CSV byte/row boundaries and formula labels', () => {
  assert.equal(core.MAX_BYTES, 2 * 1024 * 1024);
  assert.equal(core.MAX_ROWS, 5000);
  assert.throws(() => core.processCSV('x'.repeat(core.MAX_BYTES + 1)), { code: 'file_limit' });
  assert.throws(() => core.processCSV(core.STOREY_COLUMNS.join(',') + '\n' + 'A,L0,0,0,m,m\n'.repeat(5001)), { code: 'row_limit' });
  for (const label of ['=1+1', '+SUM(A1)', '-1+1', '@SUM(A1)', '\tLABEL', "'=1+1"]) {
    const rows = core.parseCSV(storey, core.STOREY_COLUMNS); rows[0].level = label;
    assert.throws(() => core.processRows(rows), { code: 'invalid_identifier' });
  }
});
test('independent equilibrium and parameter scaling', () => {
  const scenarios = core.analyzeCSV(beam).scenarios;
  const base = scenarios[0];
  close(base.summary.tip_displacement_m, .002);
  close(base.summary.tip_rotation_rad, .0015);
  close(base.summary.max_abs_bending_stress_pa, 30e6);
  close(base.summary.reaction_force_n + base.input.tip_load_n, 0);
  close(base.summary.reaction_moment_nm + base.input.tip_load_n * base.input.length_m, 0);
  close(scenarios[1].summary.tip_displacement_m / base.summary.tip_displacement_m, .5);
  close(scenarios[2].summary.tip_displacement_m / base.summary.tip_displacement_m, .5);
  close(scenarios[3].summary.tip_displacement_m / base.summary.tip_displacement_m, .125);
  close(scenarios[3].summary.max_abs_bending_stress_pa / base.summary.max_abs_bending_stress_pa, .25);
});
assert.equal(failures.length, 0, failures.join('\n'));
console.log(`PASS: ${checks} demo checks, ${invalid.length} malformed CSV cases and ${comparedNumbers} numerical comparisons against executed Python; JSON/CSV exports and structural invariants.`);
