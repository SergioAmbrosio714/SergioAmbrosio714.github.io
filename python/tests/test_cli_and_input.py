"""Real CLI exports, input protection and bounded CSV parsing."""
import csv
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from _common import MAX_BYTES, MAX_ROWS, ValidationError, number, parse_csv
import process_results


class CommandLineAndInputTests(unittest.TestCase):
    def run_cli(self, script, *args):
        return subprocess.run([sys.executable, str(ROOT / script), *map(str, args)], capture_output=True, text=True, encoding='utf-8')

    def test_both_commands_write_json_and_csv(self):
        for script, example, expected_rows, demo_name in [
            ('process_results.py', 'storey-results.csv', 8, 'storey-results'),
            ('cantilever.py', 'cantilever-scenarios.csv', 84, 'cantilever-tip-load'),
        ]:
            with self.subTest(script=script), tempfile.TemporaryDirectory() as folder:
                output = Path(folder)
                result = self.run_cli(script, ROOT / 'examples' / example, '--json', output / 'results.json', '--csv', output / 'results.csv')
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(json.loads((output / 'results.json').read_text())['demo'], demo_name)
                self.assertEqual(len(list(csv.DictReader(io.StringIO((output / 'results.csv').read_text())))), expected_rows)
                self.assertEqual(result.stdout, '')

    def test_default_stdout_is_valid_json(self):
        result = self.run_cli('process_results.py', ROOT / 'examples/storey-results.csv')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['reference_case'], 'SERVICE_A')

    def test_invalid_input_returns_two_and_creates_no_output(self):
        with tempfile.TemporaryDirectory() as folder:
            invalid = Path(folder) / 'bad.csv'
            invalid.write_text('case,level,elevation,displacement,elevation_unit,displacement_unit\nA,L0,0,NaN,m,m\n')
            output = Path(folder) / 'result.json'
            result = self.run_cli('process_results.py', invalid, '--json', output)
            self.assertEqual(result.returncode, 2)
            self.assertIn('[invalid_number]', result.stderr)
            self.assertFalse(output.exists())

    def test_output_paths_cannot_replace_input_or_each_other(self):
        with tempfile.TemporaryDirectory() as folder:
            input_path = Path(folder) / 'input.csv'
            content = (ROOT / 'examples/storey-results.csv').read_bytes()
            input_path.write_bytes(content)
            result = self.run_cli('process_results.py', input_path, '--csv', input_path)
            self.assertEqual(result.returncode, 2)
            self.assertIn('[output_path_conflict]', result.stderr)
            self.assertEqual(input_path.read_bytes(), content)
            output = Path(folder) / 'same.txt'
            result = self.run_cli('process_results.py', input_path, '--json', output, '--csv', output)
            self.assertEqual(result.returncode, 2)
            self.assertFalse(output.exists())

    def test_utf8_bom_crlf_and_reordered_columns(self):
        text = '\ufefflevel,case,displacement,elevation,displacement_unit,elevation_unit\r\nL0,A,0,0,mm,m\r\nL1,A,3,3,mm,m\r\n'
        result = process_results.process_csv(text)
        self.assertAlmostEqual(result['cases'][0]['max_abs_drift_ratio'], 0.001)

    def test_malformed_csv_missing_fields_and_extra_columns(self):
        header = ','.join(process_results.COLUMNS) + '\n'
        for row in ['A,L0,0,0,m\n', 'A,L0,0,0,m,m,EXTRA\n', 'A,L0,0,,m,m\n', '"A,L0,0,0,m,m\n']:
            with self.subTest(row=row), self.assertRaises(ValidationError):
                parse_csv(header + row, process_results.COLUMNS)

    def test_file_and_row_limits(self):
        with self.assertRaises(ValidationError) as caught:
            parse_csv('x' * (MAX_BYTES + 1), process_results.COLUMNS)
        self.assertEqual(caught.exception.code, 'file_limit')
        header = ','.join(process_results.COLUMNS) + '\n'
        row = 'A,L0,0,0,m,m\n'
        self.assertEqual(len(parse_csv(header + row * MAX_ROWS, process_results.COLUMNS)), MAX_ROWS)
        with self.assertRaises(ValidationError) as caught:
            parse_csv(header + row * (MAX_ROWS + 1), process_results.COLUMNS)
        self.assertEqual(caught.exception.code, 'row_limit')

    def test_numeric_grammar_prevents_partial_parsing_and_executable_values(self):
        for value in ['1mm', '1,000', '0x10', '1_000', 'Infinity', 'nan', '=1+1', '', '1e309']:
            with self.subTest(value=value), self.assertRaises(ValidationError):
                number(value, 'value')
        for text, expected in [('-1.5e-3', -.0015), ('+2', 2), ('.5', .5), ('2.', 2)]:
            self.assertEqual(number(text, 'value'), expected)


if __name__ == '__main__':
    unittest.main()
