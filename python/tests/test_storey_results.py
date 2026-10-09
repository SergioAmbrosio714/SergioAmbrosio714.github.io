"""Independent examples, invariants and malformed structural input checks."""
import csv
from fractions import Fraction
import io
import json
from pathlib import Path
import random
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from _common import ValidationError, parse_csv
import process_results as demo


class StoreyResultsTests(unittest.TestCase):
    def setUp(self):
        self.csv = (ROOT / 'examples/storey-results.csv').read_text(encoding='utf-8')
        self.rows = parse_csv(self.csv, demo.COLUMNS)

    def test_known_displacements_and_drift_from_exact_fractions(self):
        result = demo.process_csv(self.csv)
        self.assertEqual(result['reference_case'], 'SERVICE_A')
        a, b = result['cases']
        self.assertEqual(result['level_order'], ['L00', 'L01', 'L02', 'L03'])
        for case, millimetres in [(a, [0, 2, 6, 12]), (b, [0, 3, 8, 15])]:
            for index, point in enumerate(case['points']):
                self.assertAlmostEqual(point['displacement_m'], float(Fraction(millimetres[index], 1000)))
                if index:
                    expected = Fraction(millimetres[index] - millimetres[index - 1], 3000)
                    self.assertAlmostEqual(point['drift_ratio'], float(expected), places=14)
                else:
                    for field in ['storey_height_m', 'interstorey_displacement_m', 'drift_ratio']:
                        self.assertIsNone(point[field])
        self.assertAlmostEqual(a['max_abs_drift_ratio'], 0.002)
        self.assertAlmostEqual(b['max_abs_drift_ratio'], float(Fraction(7, 3000)))
        self.assertAlmostEqual(b['points'][-1]['difference_from_reference_m'], 0.003)

    def test_compatible_mixed_units_and_row_order_do_not_change_results(self):
        expected = demo.process_rows(self.rows)
        for index, row in enumerate(self.rows):
            if index % 2:
                row['elevation'] = str(float(row['elevation']) * 100)
                row['elevation_unit'] = 'cm'
                row['displacement'] = str(float(row['displacement']) / 1000)
                row['displacement_unit'] = 'm'
        random.Random(2026).shuffle(self.rows)
        self.assertEqual(demo.process_rows(self.rows), expected)

    def test_rigid_translation_preserves_interstorey_drift(self):
        before = demo.process_rows(self.rows)
        for row in self.rows:
            row['displacement'] = str(float(row['displacement']) + 100)
        after = demo.process_rows(self.rows)
        for original, shifted in zip(before['cases'], after['cases']):
            for a, b in zip(original['points'], shifted['points']):
                self.assertAlmostEqual(b['displacement_m'] - a['displacement_m'], 0.1)
                if a['drift_ratio'] is not None:
                    self.assertAlmostEqual(a['drift_ratio'], b['drift_ratio'], places=14)

    def test_signed_case_reversal_preserves_magnitudes(self):
        before = demo.process_rows(self.rows)
        for row in self.rows:
            row['displacement'] = str(-float(row['displacement']))
        after = demo.process_rows(self.rows)
        for original, reversed_case in zip(before['cases'], after['cases']):
            self.assertEqual(original['max_abs_drift_ratio'], reversed_case['max_abs_drift_ratio'])
            for a, b in zip(original['points'], reversed_case['points']):
                self.assertEqual(a['displacement_m'], -b['displacement_m'])

    def test_reference_switch_changes_comparison_not_geometry(self):
        result = demo.process_csv(self.csv, 'SERVICE_B')
        self.assertEqual(result['reference_case'], 'SERVICE_B')
        self.assertAlmostEqual(result['cases'][0]['points'][-1]['difference_from_reference_m'], -0.003)
        self.assertEqual(result['cases'][1]['points'][-1]['difference_from_reference_m'], 0)

    def test_basements_and_nonzero_initial_displacement_are_supported(self):
        for row in self.rows:
            row['elevation'] = str(float(row['elevation']) - 6)
            row['displacement'] = str(float(row['displacement']) + 2)
        result = demo.process_rows(self.rows)
        self.assertEqual(result['cases'][0]['points'][0]['elevation_m'], -6)
        self.assertAlmostEqual(result['cases'][0]['max_abs_drift_ratio'], 0.002)

    def test_fixture_is_current_and_export_uses_explicit_si_columns(self):
        result = demo.process_csv(self.csv, 'SERVICE_A')
        self.assertEqual(result, json.loads((ROOT / 'fixtures/storey-results.json').read_text()))
        rows = list(csv.DictReader(io.StringIO(demo.export_csv(result))))
        self.assertEqual(len(rows), 8)
        self.assertEqual(tuple(rows[0]), demo.EXPORT_COLUMNS)
        self.assertEqual(rows[0]['drift_ratio'], '')
        self.assertAlmostEqual(float(rows[-1]['displacement_m']), 0.015)

    def test_validation_examples_expose_stable_error_codes(self):
        cases = json.loads((ROOT / 'fixtures/validation-cases.json').read_text())['storey']
        for case in cases:
            with self.subTest(case=case['id']):
                with self.assertRaises(ValidationError) as caught:
                    demo.process_csv(case['csv'], case.get('reference'))
                self.assertEqual(caught.exception.code, case['error_code'])

    def test_csv_formula_and_control_prefixes_are_rejected(self):
        for label in ['=1+1', '+SUM(A1)', '-1+1', '@SUM(A1)', '\tABC', '\nABC', "'=1+1"]:
            rows = [dict(row) for row in self.rows]
            rows[0]['level'] = label
            with self.subTest(label=label), self.assertRaises(ValidationError) as caught:
                demo.process_rows(rows)
            self.assertEqual(caught.exception.code, 'invalid_identifier')

    def test_nonreference_case_cannot_have_repeated_elevation(self):
        self.rows[-1]['elevation'] = '6'
        with self.assertRaises(ValidationError) as caught:
            demo.process_rows(self.rows)
        self.assertEqual(caught.exception.code, 'duplicate_elevation')


if __name__ == '__main__':
    unittest.main()
