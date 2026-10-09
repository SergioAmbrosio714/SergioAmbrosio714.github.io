"""Shared input/output validation for the original 2026 portfolio demonstrations."""
from __future__ import annotations

import csv
import io
import json
import math
import os
from pathlib import Path
import re
import tempfile

MAX_BYTES = 2 * 1024 * 1024
MAX_ROWS = 5_000
IDENTIFIER = re.compile(r"[A-Za-z0-9][A-Za-z0-9_. /()+-]{0,63}\Z")
NUMBER = re.compile(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?\Z", re.ASCII)


class ValidationError(ValueError):
    """An input cannot represent the documented engineering model."""

    def __init__(self, message: str, code: str = 'invalid_input') -> None:
        super().__init__(message)
        self.code = code


def identifier(value: str, label: str) -> str:
    # Reject controls before stripping. This also prevents spreadsheet formula
    # injection through exported case/level/scenario labels.
    if not isinstance(value, str) or any(ord(char) < 32 for char in value):
        raise ValidationError(f"{label}: invalid identifier", 'invalid_identifier')
    value = value.strip()
    if not IDENTIFIER.fullmatch(value):
        raise ValidationError(f"{label}: use 1–64 ASCII letters/numbers and safe separators; start with a letter or digit", 'invalid_identifier')
    return value


def number(value: str | float, label: str, *, positive: bool = False) -> float:
    if isinstance(value, bool):
        raise ValidationError(f"{label}: a finite decimal number is required", 'invalid_number')
    if isinstance(value, str):
        value = value.strip()
        if not NUMBER.fullmatch(value):
            raise ValidationError(f"{label}: a finite decimal number is required (decimal point, no thousands separator)", 'invalid_number')
    try:
        result = float(value)
    except (TypeError, ValueError, OverflowError) as error:
        raise ValidationError(f"{label}: a finite number is required", 'invalid_number') from error
    if not math.isfinite(result) or (positive and result <= 0):
        raise ValidationError(f"{label}: {'positive ' if positive else ''}finite number required", 'invalid_number')
    return result


def parse_csv(text: str, columns: tuple[str, ...]) -> list[dict[str, str]]:
    if not isinstance(text, str) or len(text.encode('utf-8')) > MAX_BYTES:
        raise ValidationError(f"CSV exceeds {MAX_BYTES} bytes", 'file_limit')
    try:
        reader = csv.DictReader(io.StringIO(text.lstrip('\ufeff'), newline=''), strict=True)
        header = reader.fieldnames
        if not header or len(header) != len(columns) or set(header) != set(columns):
            raise ValidationError('CSV columns must be exactly: ' + ','.join(columns), 'invalid_csv')
        rows = []
        for row in reader:
            if len(rows) >= MAX_ROWS:
                raise ValidationError(f"CSV exceeds {MAX_ROWS} rows", 'row_limit')
            if None in row or any(value is None or not value.strip() for value in row.values()):
                raise ValidationError(f"CSV line {reader.line_num}: missing or extra field", 'missing_field')
            rows.append(row)
    except csv.Error as error:
        raise ValidationError(f"Malformed CSV: {error}", 'invalid_csv') from error
    if not rows:
        raise ValidationError('CSV requires at least one data row', 'empty_data')
    return rows


def read_csv(path: str | Path, columns: tuple[str, ...]) -> list[dict[str, str]]:
    path = Path(path)
    if path.stat().st_size > MAX_BYTES:
        raise ValidationError(f"CSV exceeds {MAX_BYTES} bytes", 'file_limit')
    return parse_csv(path.read_text(encoding='utf-8-sig'), columns)


def ensure_finite(value: object) -> None:
    """Reject overflow from mathematically valid but numerically extreme inputs."""
    if isinstance(value, float) and not math.isfinite(value):
        raise ValidationError('Numerical range exceeded; use physically meaningful SI values', 'numeric_range')
    if isinstance(value, dict):
        for nested in value.values():
            ensure_finite(nested)
    elif isinstance(value, (list, tuple)):
        for nested in value:
            ensure_finite(nested)


def json_text(result: dict) -> str:
    ensure_finite(result)
    return json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False) + '\n'


def csv_text(columns: tuple[str, ...], rows: list[dict]) -> str:
    output = io.StringIO(newline='')
    writer = csv.DictWriter(output, fieldnames=columns, lineterminator='\n')
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()


def write_outputs(input_path: str | Path, outputs: list[tuple[str | None, str]]) -> None:
    paths = [Path(destination).resolve() for destination, _ in outputs if destination]
    if len(set(paths)) != len(paths) or Path(input_path).resolve() in paths:
        raise ValidationError('Input and output paths must be distinct', 'output_path_conflict')
    for destination, content in outputs:
        if not destination:
            continue
        target = Path(destination).resolve()
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', newline='', dir=target.parent, delete=False) as handle:
                temporary = Path(handle.name)
                handle.write(content)
            os.replace(temporary, target)
        finally:
            if temporary and temporary.exists():
                temporary.unlink()
