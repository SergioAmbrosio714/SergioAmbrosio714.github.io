"""Regenerate browser/Python comparison fixtures; unit tests validate their physics.

python python/build_fixtures.py [--check]
No timestamps, random values or third-party packages are used.
"""
import argparse
from pathlib import Path
import sys

from _common import json_text
import cantilever
import process_results

ROOT = Path(__file__).resolve().parent


def validation_cases(storey: str, beam: str) -> dict:
    storey_lines = storey.splitlines()
    beam_lines = beam.splitlines()
    return {
        'schema_version': 1,
        'storey': [
            {'id': 'missing-displacement', 'csv': storey.replace(',3,2,m,mm', ',3,,m,mm'), 'error_code': 'missing_field'},
            {'id': 'duplicate-level', 'csv': storey + storey_lines[1] + '\n', 'error_code': 'duplicate_case_level'},
            {'id': 'unsupported-unit', 'csv': storey.replace('m,mm', 'm,kN', 1), 'error_code': 'unsupported_unit'},
            {'id': 'incompatible-elevation', 'csv': storey.replace('SERVICE_B,L01,3,3', 'SERVICE_B,L01,4,3'), 'error_code': 'incompatible_profile'},
            {'id': 'missing-level', 'csv': '\n'.join(storey_lines[:-1]) + '\n', 'error_code': 'incompatible_profile'},
            {'id': 'duplicate-elevation', 'csv': storey.replace('SERVICE_A,L01,3,2', 'SERVICE_A,L01,0,2'), 'error_code': 'duplicate_elevation'},
            {'id': 'not-finite', 'csv': storey.replace(',3,2,m,mm', ',3,NaN,m,mm'), 'error_code': 'invalid_number'},
            {'id': 'overflow', 'csv': storey.replace(',3,2,m,mm', ',3,1e309,m,mm'), 'error_code': 'invalid_number'},
            {'id': 'spreadsheet-formula', 'csv': storey.replace('SERVICE_A', '=1+1'), 'error_code': 'invalid_identifier'},
            {'id': 'unknown-reference', 'csv': storey, 'reference': 'UNKNOWN', 'error_code': 'invalid_reference'},
            {'id': 'duplicate-header', 'csv': storey.replace('case,level,', 'case,case,', 1), 'error_code': 'invalid_csv'},
            {'id': 'no-data', 'csv': storey_lines[0] + '\n', 'error_code': 'empty_data'},
            {'id': 'only-one-level', 'csv': '\n'.join(storey_lines[:2]) + '\n', 'error_code': 'insufficient_levels'},
        ],
        'cantilever': [
            {'id': 'zero-length', 'csv': beam.replace('BASE,2,', 'BASE,0,'), 'error_code': 'invalid_number'},
            {'id': 'negative-modulus', 'csv': beam.replace(',200000000000,', ',-200000000000,', 1), 'error_code': 'invalid_number'},
            {'id': 'nonfinite-load', 'csv': beam.replace(',10000,', ',Infinity,', 1), 'error_code': 'invalid_number'},
            {'id': 'missing-reference-stress', 'csv': beam.replace(',250000000\n', ',\n', 1), 'error_code': 'missing_field'},
            {'id': 'duplicate-scenario', 'csv': beam + beam_lines[1] + '\n', 'error_code': 'duplicate_scenario'},
            {'id': 'spreadsheet-formula', 'csv': beam.replace('BASE,', '@SUM(A1:A2),', 1), 'error_code': 'invalid_identifier'},
            {'id': 'too-few-stations', 'csv': beam, 'samples': 1, 'error_code': 'invalid_samples'},
            {'id': 'too-many-stations', 'csv': beam, 'samples': 1002, 'error_code': 'invalid_samples'},
            {'id': 'section-overflow', 'csv': beam.replace('BASE,2,0.1,0.2,', 'BASE,2,0.1,1e200,'), 'error_code': 'numeric_range'},
            {'id': 'rigidity-denominator-overflow', 'csv': beam.replace('BASE,2,0.1,0.2,200000000000,', 'BASE,2,1000,0.2,1e308,'), 'error_code': 'numeric_range'},
        ],
    }


def outputs() -> dict[str, str]:
    storey = (ROOT / 'examples/storey-results.csv').read_text(encoding='utf-8')
    beam = (ROOT / 'examples/cantilever-scenarios.csv').read_text(encoding='utf-8')
    return {
        'storey-results.json': json_text(process_results.process_csv(storey, 'SERVICE_A')),
        'cantilever.json': json_text(cantilever.analyze_csv(beam, 21)),
        'validation-cases.json': json_text(validation_cases(storey, beam)),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    stale = []
    for name, content in outputs().items():
        target = ROOT / 'fixtures' / name
        if not target.exists() or target.read_text(encoding='utf-8') != content:
            stale.append(name)
            if not args.check:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content, encoding='utf-8', newline='\n')
    if args.check and stale:
        print('Stale Python fixtures: ' + ', '.join(stale), file=sys.stderr)
        return 1
    print(f'Python fixtures: {len(outputs())} checked; {len(stale)} ' + ('stale' if args.check else 'updated'))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
