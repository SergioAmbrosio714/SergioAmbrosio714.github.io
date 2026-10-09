"""Linear Euler–Bernoulli cantilever with a signed point load at the free end.

Original, analytical portfolio demonstration (2026), not a code design check.
Run: python cantilever.py examples/cantilever-scenarios.csv --samples 21
"""
from __future__ import annotations

import argparse
import math
import sys
from _common import ValidationError, csv_text, ensure_finite, identifier, number, parse_csv, read_csv, json_text, write_outputs

COLUMNS = ('scenario', 'length_m', 'width_m', 'depth_m', 'elastic_modulus_pa', 'tip_load_n', 'reference_stress_pa')
EXPORT_COLUMNS = ('scenario', 'x_m', 'shear_n', 'moment_nm', 'displacement_m', 'rotation_rad', 'extreme_fibre_stress_pa')


def analyze_scenario(row: dict, samples: int = 21) -> dict:
    if isinstance(samples, bool) or not isinstance(samples, int) or not 2 <= samples <= 1001:
        raise ValidationError('samples must be an integer between 2 and 1001', 'invalid_samples')
    if set(row) != set(COLUMNS):
        raise ValidationError('Scenario fields must be exactly: ' + ','.join(COLUMNS), 'invalid_csv')
    scenario = identifier(row['scenario'], 'scenario')
    data = {key: number(row[key], key, positive=key != 'tip_load_n') for key in COLUMNS[1:]}
    L, b, h, E, P, reference = (data[key] for key in COLUMNS[1:])
    try:
        area = b * h
        inertia = b * h ** 3 / 12
        rigidity = E * inertia
        if not all(math.isfinite(value) and value > 0 for value in (area, inertia, rigidity, 6 * rigidity)):
            raise ValidationError('Section/rigidity is outside the supported numerical range', 'numeric_range')
        points = []
        for index in range(samples):
            x = L * (index / (samples - 1))
            moment = P * (L - x)
            points.append({'x_m': x, 'shear_n': P, 'moment_nm': moment,
                           'displacement_m': P * x ** 2 * (3 * L - x) / (6 * rigidity),
                           'rotation_rad': P * x * (2 * L - x) / (2 * rigidity),
                           'extreme_fibre_stress_pa': moment * (h / 2) / inertia})
        stress = abs(P * L) * (h / 2) / inertia
        summary = {'reaction_force_n': -P, 'reaction_moment_nm': -P * L,
                   'tip_displacement_m': P * L ** 3 / (3 * rigidity),
                   'tip_rotation_rad': P * L ** 2 / (2 * rigidity),
                   'max_abs_bending_stress_pa': stress, 'stress_reference_ratio': stress / reference}
        result = {'scenario': scenario, 'input': data, 'section': {'area_m2': area, 'second_moment_m4': inertia},
                  'summary': summary, 'points': points}
        ensure_finite(result)
        return result
    except (OverflowError, ZeroDivisionError) as error:
        raise ValidationError('Numerical range exceeded; use physically meaningful SI values', 'numeric_range') from error


def analyze_rows(rows: list[dict], samples: int = 21) -> dict:
    if not rows:
        raise ValidationError('At least one scenario is required', 'empty_data')
    scenarios, identifiers = [], set()
    for row in rows:
        scenario = analyze_scenario(row, samples)
        if scenario['scenario'] in identifiers:
            raise ValidationError('Duplicate scenario: ' + scenario['scenario'], 'duplicate_scenario')
        identifiers.add(scenario['scenario'])
        scenarios.append(scenario)
    return {'schema_version': 1, 'demo': 'cantilever-tip-load', 'samples': samples, 'scenarios': scenarios}


def analyze_csv(text: str, samples: int = 21) -> dict:
    return analyze_rows(parse_csv(text, COLUMNS), samples)


def export_csv(result: dict) -> str:
    return csv_text(EXPORT_COLUMNS, [dict(scenario=scenario['scenario'], **point)
                                    for scenario in result['scenarios'] for point in scenario['points']])


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', help='CSV of SI rectangular cantilever scenarios')
    parser.add_argument('--samples', type=int, default=21, help='Uniform stations including both ends; 2–1001')
    parser.add_argument('--json', metavar='PATH', help='Write scenarios, summaries and curves as JSON')
    parser.add_argument('--csv', metavar='PATH', help='Write long-form sampled curves as CSV')
    args = parser.parse_args(argv)
    try:
        result = analyze_rows(read_csv(args.input, COLUMNS), args.samples)
        text = json_text(result)
        write_outputs(args.input, [(args.json, text), (args.csv, export_csv(result))])
        if not args.json and not args.csv:
            print(text, end='')
    except (ValidationError, OSError, UnicodeError) as error:
        print(f'Error [{getattr(error, "code", "io_error")}]: {error}', file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
