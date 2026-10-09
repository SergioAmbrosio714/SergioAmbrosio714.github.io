"""Normalize signed, simultaneous storey displacements and compare load cases.

Original portfolio demonstration, 2026. No ETABS/SAP2000 connection is made.
Run: python process_results.py examples/storey-results.csv --json results.json
"""
from __future__ import annotations

import argparse
import math
import sys
from _common import ValidationError, csv_text, ensure_finite, identifier, number, parse_csv, read_csv, json_text, write_outputs

COLUMNS = ('case', 'level', 'elevation', 'displacement', 'elevation_unit', 'displacement_unit')
EXPORT_COLUMNS = ('case', 'level', 'elevation_m', 'displacement_m', 'storey_height_m', 'interstorey_displacement_m', 'drift_ratio', 'reference_case', 'difference_from_reference_m')
LENGTH_UNITS = {'m': 1.0, 'cm': 0.01, 'mm': 0.001}


def length(value: str, unit: str, label: str) -> float:
    if not isinstance(unit, str):
        raise ValidationError(f"{label}: unit must be m, cm or mm", 'unsupported_unit')
    unit = unit.strip()
    if unit not in LENGTH_UNITS:
        raise ValidationError(f"{label}: unsupported length unit '{unit}'; use m, cm or mm", 'unsupported_unit')
    return number(value, label) * LENGTH_UNITS[unit]


def process_rows(rows: list[dict[str, str]], reference_case: str | None = None) -> dict:
    if not rows:
        raise ValidationError('At least two levels in each case are required', 'insufficient_levels')
    grouped: dict[str, dict[str, tuple[float, float]]] = {}
    for index, row in enumerate(rows, 2):
        if set(row) != set(COLUMNS):
            raise ValidationError(f"Row {index}: wrong fields", 'invalid_csv')
        case = identifier(row['case'], f'Row {index} case')
        level = identifier(row['level'], f'Row {index} level')
        elevation = length(row['elevation'], row['elevation_unit'], f'Row {index} elevation')
        displacement = length(row['displacement'], row['displacement_unit'], f'Row {index} displacement')
        levels = grouped.setdefault(case, {})
        if level in levels:
            raise ValidationError(f"Duplicate case/level: {case}/{level}", 'duplicate_case_level')
        levels[level] = (elevation, displacement)
    case_names = sorted(grouped)
    reference_case = identifier(reference_case, 'Reference case') if reference_case is not None else case_names[0]
    if reference_case not in grouped:
        raise ValidationError(f"Reference case not present: {reference_case}", 'invalid_reference')
    reference = grouped[reference_case]
    if len(reference) < 2:
        raise ValidationError('At least two levels in each case are required', 'insufficient_levels')
    level_order = sorted(reference, key=lambda level: reference[level][0])
    previous_elevation = None
    for level in level_order:
        elevation = reference[level][0]
        if previous_elevation is not None and elevation <= previous_elevation:
            raise ValidationError('Every level must have a distinct, increasing elevation', 'duplicate_elevation')
        previous_elevation = elevation
    cases = []
    for case in case_names:
        values = grouped[case]
        if set(values) != set(reference):
            raise ValidationError(f"Incompatible level profile in {case}; every case must have the same levels", 'incompatible_profile')
        if len({value[0] for value in values.values()}) != len(values):
            raise ValidationError(f"Repeated elevation in {case}", 'duplicate_elevation')
        points = []
        previous_displacement = None
        previous_elevation = None
        for level in level_order:
            elevation, displacement = values[level]
            if not math.isclose(elevation, reference[level][0], rel_tol=1e-9, abs_tol=1e-9):
                raise ValidationError(f"Incompatible elevation in {case}/{level}", 'incompatible_profile')
            # Use the reference geometry for comparisons after the tolerance check.
            elevation = reference[level][0]
            height = None if previous_elevation is None else elevation - previous_elevation
            delta = None if previous_displacement is None else displacement - previous_displacement
            drift = None if height is None else delta / height
            points.append({'level': level, 'elevation_m': elevation, 'displacement_m': displacement,
                           'storey_height_m': height, 'interstorey_displacement_m': delta, 'drift_ratio': drift,
                           'difference_from_reference_m': displacement - reference[level][1]})
            previous_elevation, previous_displacement = elevation, displacement
        cases.append({'case': case, 'max_abs_displacement_m': max(abs(point['displacement_m']) for point in points),
                      'max_abs_drift_ratio': max(abs(point['drift_ratio']) for point in points[1:]), 'points': points})
    result = {'schema_version': 1, 'demo': 'storey-results', 'reference_case': reference_case,
              'level_order': level_order, 'cases': cases}
    ensure_finite(result)
    return result


def process_csv(text: str, reference_case: str | None = None) -> dict:
    return process_rows(parse_csv(text, COLUMNS), reference_case)


def export_csv(result: dict) -> str:
    return csv_text(EXPORT_COLUMNS, [dict(case=case['case'], reference_case=result['reference_case'], **point)
                                    for case in result['cases'] for point in case['points']])


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', help='CSV in the documented case/level/unit schema')
    parser.add_argument('--reference', help='Reference case; default: first case in lexical order')
    parser.add_argument('--json', metavar='PATH', help='Write normalized results as JSON')
    parser.add_argument('--csv', metavar='PATH', help='Write normalized long-form results as CSV')
    args = parser.parse_args(argv)
    try:
        result = process_rows(read_csv(args.input, COLUMNS), args.reference)
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
