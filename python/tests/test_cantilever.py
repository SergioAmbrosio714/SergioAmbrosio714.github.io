"""Equilibrium, virtual work and differential/scaling properties, stdlib only."""
import json
import math
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from _common import ValidationError
import cantilever as demo

BASE = {'scenario': 'TEST', 'length_m': 2, 'width_m': 0.1, 'depth_m': 0.2,
        'elastic_modulus_pa': 200e9, 'tip_load_n': 10000, 'reference_stress_pa': 250e6}


def simpson(function, length, segments=200):
    """Independent numerical quadrature, not the implementation's displacement formula."""
    dx = length / segments
    weights = [1] + [4 if i % 2 else 2 for i in range(1, segments)] + [1]
    return dx / 3 * sum(weight * function(i * dx) for i, weight in enumerate(weights))


class CantileverTests(unittest.TestCase):
    def test_hand_calculated_rectangular_example(self):
        result = demo.analyze_scenario(BASE)
        self.assertAlmostEqual(result['section']['area_m2'], 0.02)
        self.assertAlmostEqual(result['section']['second_moment_m4'], 1 / 15000, places=15)
        summary = result['summary']
        self.assertAlmostEqual(summary['tip_displacement_m'], 0.002, places=14)
        self.assertAlmostEqual(summary['tip_rotation_rad'], 0.0015, places=14)
        self.assertAlmostEqual(summary['max_abs_bending_stress_pa'], 30e6, places=6)
        self.assertAlmostEqual(summary['stress_reference_ratio'], 0.12)

    def test_tip_displacement_from_independent_unit_load_virtual_work(self):
        for L, b, h, E, P in [(2, .1, .2, 200e9, 10000), (3.7, .16, .42, 30e9, -18000), (1.2, .2, .15, 70e9, 0)]:
            with self.subTest(L=L, P=P):
                result = demo.analyze_scenario(dict(BASE, length_m=L, width_m=b, depth_m=h, elastic_modulus_pa=E, tip_load_n=P))
                # Integrate section y² dA independently to obtain I; Simpson is
                # exact for this rectangular section's quadratic integrand.
                inertia = simpson(lambda y: b * (y - h / 2) ** 2, h)
                displacement = simpson(lambda x: (P * (L - x)) * (L - x) / (E * inertia), L)
                rotation = simpson(lambda x: P * (L - x) / (E * inertia), L)
                self.assertAlmostEqual(result['summary']['tip_displacement_m'], displacement, places=12)
                self.assertAlmostEqual(result['summary']['tip_rotation_rad'], rotation, places=12)

    def test_castigliano_energy_derivative_matches_tip_displacement(self):
        L, E, P = BASE['length_m'], BASE['elastic_modulus_pa'], BASE['tip_load_n']
        I = simpson(lambda y: BASE['width_m'] * (y - BASE['depth_m'] / 2) ** 2, BASE['depth_m'])
        energy = lambda force: simpson(lambda x: (force * (L - x)) ** 2 / (2 * E * I), L)
        step = 1.0
        energy_derivative = (energy(P + step) - energy(P - step)) / (2 * step)
        self.assertAlmostEqual(demo.analyze_scenario(BASE)['summary']['tip_displacement_m'], energy_derivative, places=12)

    def test_equilibrium_boundary_conditions_and_section_balance(self):
        result = demo.analyze_scenario(BASE, 101)
        summary, points = result['summary'], result['points']
        P, L = BASE['tip_load_n'], BASE['length_m']
        self.assertEqual(summary['reaction_force_n'] + P, 0)
        self.assertEqual(summary['reaction_moment_nm'] + P * L, 0)
        self.assertEqual(points[0]['displacement_m'], 0)
        self.assertEqual(points[0]['rotation_rad'], 0)
        self.assertEqual(points[-1]['moment_nm'], 0)
        self.assertEqual(points[-1]['x_m'], L)
        for point in points:
            self.assertAlmostEqual(point['moment_nm'] + P * point['x_m'], P * L, places=9)
            self.assertEqual(point['shear_n'], P)

    def test_differential_relations_throughout_member(self):
        result = demo.analyze_scenario(BASE, 101)
        points = result['points']
        EI = BASE['elastic_modulus_pa'] * result['section']['second_moment_m4']
        for a, middle, b in zip(points, points[1:], points[2:]):
            width = b['x_m'] - a['x_m']
            self.assertAlmostEqual((b['moment_nm'] - a['moment_nm']) / width, -middle['shear_n'], delta=1e-7)
            self.assertAlmostEqual((b['rotation_rad'] - a['rotation_rad']) / width, middle['moment_nm'] / EI, delta=1e-12)
            # Central derivative of the cubic displacement has an O(dx²) error.
            self.assertAlmostEqual((b['displacement_m'] - a['displacement_m']) / width, middle['rotation_rad'], delta=6e-8)

    def test_parametric_scaling_properties(self):
        original = demo.analyze_scenario(BASE)['summary']
        changes = [('tip_load_n', 2, 2, 2), ('elastic_modulus_pa', 2, .5, 1),
                   ('length_m', 2, 8, 2), ('width_m', 2, .5, .5), ('depth_m', 2, .125, .25)]
        for field, factor, displacement_ratio, stress_ratio in changes:
            with self.subTest(field=field):
                changed = demo.analyze_scenario(dict(BASE, **{field: BASE[field] * factor}))['summary']
                self.assertAlmostEqual(changed['tip_displacement_m'] / original['tip_displacement_m'], displacement_ratio)
                self.assertAlmostEqual(changed['max_abs_bending_stress_pa'] / original['max_abs_bending_stress_pa'], stress_ratio)

    def test_signed_load_reverses_response_and_zero_load_is_zero(self):
        original = demo.analyze_scenario(BASE)
        reversed_case = demo.analyze_scenario(dict(BASE, tip_load_n=-BASE['tip_load_n']))
        for a, b in zip(original['points'], reversed_case['points']):
            for key in demo.EXPORT_COLUMNS[2:]:
                self.assertEqual(a[key], -b[key])
        zero = demo.analyze_scenario(dict(BASE, tip_load_n=0))
        for key, value in zero['summary'].items():
            self.assertEqual(value, 0, key)

    def test_sampling_does_not_change_summary(self):
        self.assertEqual(demo.analyze_scenario(BASE, 2)['summary'], demo.analyze_scenario(BASE, 1001)['summary'])

    def test_reference_stress_changes_only_comparison_ratio(self):
        a = demo.analyze_scenario(BASE)
        b = demo.analyze_scenario(dict(BASE, reference_stress_pa=500e6))
        self.assertEqual(a['points'], b['points'])
        self.assertAlmostEqual(b['summary']['stress_reference_ratio'], a['summary']['stress_reference_ratio'] / 2)

    def test_invalid_geometry_material_and_load_values(self):
        for field in demo.COLUMNS[1:]:
            invalid = [float('nan'), float('inf'), float('-inf'), True]
            if field != 'tip_load_n':
                invalid += [0, -1]
            for value in invalid:
                with self.subTest(field=field, value=value), self.assertRaises(ValidationError):
                    demo.analyze_scenario(dict(BASE, **{field: value}))
        for samples in [1, 1002, 2.5, True]:
            with self.subTest(samples=samples), self.assertRaises(ValidationError):
                demo.analyze_scenario(BASE, samples)

    def test_numerical_underflow_or_overflow_is_not_silently_reported(self):
        for change in [dict(depth_m=1e-200), dict(depth_m=1e200), dict(elastic_modulus_pa=1e308, width_m=1000), dict(length_m=1e200)]:
            with self.subTest(change=change), self.assertRaises(ValidationError):
                demo.analyze_scenario(dict(BASE, **change))

    def test_golden_and_invalid_fixtures(self):
        text = (ROOT / 'examples/cantilever-scenarios.csv').read_text()
        expected = json.loads((ROOT / 'fixtures/cantilever.json').read_text())
        self.assertEqual(demo.analyze_csv(text, 21), expected)
        cases = json.loads((ROOT / 'fixtures/validation-cases.json').read_text())['cantilever']
        for case in cases:
            with self.subTest(case=case['id']):
                with self.assertRaises(ValidationError) as caught:
                    demo.analyze_csv(case['csv'], case.get('samples', 21))
                self.assertEqual(caught.exception.code, case['error_code'])


if __name__ == '__main__':
    unittest.main()
