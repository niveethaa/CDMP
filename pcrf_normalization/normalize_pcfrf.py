from __future__ import annotations

import argparse
import csv
import re
import sys
import zipfile
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Iterable, Iterator


OUTPUT_COLUMNS = [
    "boundarySet",
    "postalCode",
    "fsa",
    "provinceCode",
    "ridingCode",
    "ridingName",
    "uniqueLink",
    "weight",
    "sourceFile",
    "referenceDate",
]

PROVINCE_BY_PRUID = {
    "10": "NL",
    "11": "PE",
    "12": "NS",
    "13": "NB",
    "24": "QC",
    "35": "ON",
    "46": "MB",
    "47": "SK",
    "48": "AB",
    "59": "BC",
    "60": "YT",
    "61": "NT",
    "62": "NU",
}

EXPECTED_RIDING_COUNTS = {
    "federal_ridings_1996": 301,
    "federal_ridings_2003": 308,
    "federal_ridings_2013": 338,
    "federal_ridings_2023": 343,
}

POSTAL_CODE_RE = re.compile(r"^[ABCEGHJ-NPRSTVXY][0-9][ABCEGHJ-NPRSTV-Z][0-9][ABCEGHJ-NPRSTV-Z][0-9]$")
SKIP_SUFFIXES = {".pdf", ".htm", ".html", ".xml", ".doc", ".docx", ".xls", ".xlsx", ".dbf", ".shp", ".shx"}


@dataclass(frozen=True)
class SourceSpec:
    boundary_set: str
    reference_date: str
    source_label: str
    path: Path


def parse_source_spec(value: str) -> SourceSpec:
    try:
        row = next(csv.reader([value]))
    except csv.Error as exc:
        raise argparse.ArgumentTypeError(str(exc)) from exc

    if len(row) != 4:
        raise argparse.ArgumentTypeError(
            "--source must have four CSV fields: boundarySet,referenceDate,sourceFile,path"
        )

    boundary_set, reference_date, source_label, path = [item.strip() for item in row]
    if not boundary_set or not reference_date or not source_label or not path:
        raise argparse.ArgumentTypeError("--source fields cannot be blank")

    return SourceSpec(
        boundary_set=boundary_set,
        reference_date=reference_date,
        source_label=source_label,
        path=Path(path),
    )


def normalize_postal_code(value: str) -> str:
    return re.sub(r"[\s-]+", "", value).upper()


def collapse_spaces(value: str) -> str:
    return " ".join(value.strip().split())


def decode_text(data: bytes) -> str:
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("latin-1", errors="replace")


def iter_text_payloads(path: Path) -> Iterator[tuple[str, str]]:
    if not path.exists():
        raise FileNotFoundError(path)

    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as archive:
            for member in archive.infolist():
                member_path = Path(member.filename)
                if member.is_dir() or member_path.suffix.lower() in SKIP_SUFFIXES:
                    continue
                yield member.filename, decode_text(archive.read(member))
        return

    if path.suffix.lower() in SKIP_SUFFIXES:
        return
    yield path.name, decode_text(path.read_bytes())


def parse_weight(value: str) -> str:
    raw_value = value.strip()
    if not raw_value:
        return ""

    if raw_value.isdigit() and len(raw_value) == 3:
        weight = Decimal(raw_value) / Decimal("100")
    else:
        try:
            weight = Decimal(raw_value)
        except InvalidOperation as exc:
            raise ValueError(f"invalid weight {raw_value!r}") from exc

    return format(weight.normalize(), "f")


def parse_fixed_width_records(source: SourceSpec, member_name: str, text: str) -> Iterator[dict[str, str]]:
    for line_number, line in enumerate(text.splitlines(), start=1):
        if len(line) < 123:
            continue

        postal_code = normalize_postal_code(line[0:6])
        riding_code = line[6:11].strip()
        if not POSTAL_CODE_RE.match(postal_code) or not riding_code.isdigit():
            continue

        unique_link = ""
        weight = ""
        if len(line) >= 127:
            unique_link = line[123:124].strip()
            try:
                weight = parse_weight(line[124:127])
            except ValueError as exc:
                raise ValueError(f"{source.path}:{member_name}:{line_number}: {exc}") from exc

        yield {
            "boundarySet": source.boundary_set,
            "postalCode": postal_code,
            "fsa": postal_code[:3],
            "provinceCode": PROVINCE_BY_PRUID.get(riding_code[:2], ""),
            "ridingCode": riding_code,
            "ridingName": collapse_spaces(line[11:67]),
            "uniqueLink": unique_link,
            "weight": weight,
            "sourceFile": source.source_label,
            "referenceDate": source.reference_date,
        }


def iter_source_records(source: SourceSpec) -> Iterator[dict[str, str]]:
    for member_name, text in iter_text_payloads(source.path):
        yield from parse_fixed_width_records(source, member_name, text)


def write_records(records: Iterable[dict[str, str]], output_path: Path, append: bool) -> int:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    mode = "a" if append and output_path.exists() else "w"
    count = 0

    with output_path.open(mode, newline="", encoding="utf-8") as output_file:
        writer = csv.DictWriter(output_file, fieldnames=OUTPUT_COLUMNS)
        if mode == "w":
            writer.writeheader()
        for record in records:
            writer.writerow(record)
            count += 1

    return count


def summarize(records: list[dict[str, str]]) -> list[str]:
    messages = []
    by_boundary: dict[str, list[dict[str, str]]] = {}
    for record in records:
        by_boundary.setdefault(record["boundarySet"], []).append(record)

    for boundary_set, boundary_records in sorted(by_boundary.items()):
        postal_codes = {record["postalCode"] for record in boundary_records}
        riding_codes = {record["ridingCode"] for record in boundary_records}
        ambiguous = {
            record["postalCode"]
            for record in boundary_records
            if record["uniqueLink"] == "2"
        }
        messages.append(
            f"{boundary_set}: {len(boundary_records):,} records, "
            f"{len(postal_codes):,} postal codes, {len(riding_codes):,} ridings, "
            f"{len(ambiguous):,} postal codes marked non-unique"
        )

        expected = EXPECTED_RIDING_COUNTS.get(boundary_set)
        if expected and len(riding_codes) != expected:
            messages.append(
                f"warning: {boundary_set} has {len(riding_codes):,} riding codes; expected {expected:,}"
            )

    return messages


def fill_missing_unique_links(records: list[dict[str, str]]) -> None:
    postal_counts: dict[tuple[str, str], int] = {}
    for record in records:
        key = (record["boundarySet"], record["postalCode"])
        postal_counts[key] = postal_counts.get(key, 0) + 1

    for record in records:
        if record["uniqueLink"]:
            continue

        key = (record["boundarySet"], record["postalCode"])
        mapping_count = postal_counts[key]
        record["uniqueLink"] = "1" if mapping_count == 1 else "2"
        if mapping_count == 1 and not record["weight"]:
            record["weight"] = "1"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Normalize PCFRF fixed-width files into postal_riding_mappings.csv"
    )
    parser.add_argument(
        "--source",
        action="append",
        type=parse_source_spec,
        required=True,
        help="CSV tuple: boundarySet,referenceDate,sourceFile,path",
    )
    parser.add_argument(
        "--output",
        required=True,
        type=Path,
        help="Output CSV path, e.g. data/reference/postal_riding_mappings.csv",
    )
    parser.add_argument(
        "--append",
        action="store_true",
        help="Append to an existing output CSV instead of replacing it",
    )
    parser.add_argument(
        "--allow-empty",
        action="store_true",
        help="Exit successfully even if no PCFRF records are parsed",
    )
    args = parser.parse_args()

    records: list[dict[str, str]] = []
    seen_keys: set[tuple[str, str, str, str, str, str, str]] = set()

    for source in args.source:
        source_records = 0
        for record in iter_source_records(source):
            key = (
                record["boundarySet"],
                record["postalCode"],
                record["ridingCode"],
                record["uniqueLink"],
                record["weight"],
                record["sourceFile"],
                record["referenceDate"],
            )
            if key in seen_keys:
                continue
            seen_keys.add(key)
            records.append(record)
            source_records += 1
        print(f"{source.source_label}: parsed {source_records:,} records", file=sys.stderr)

    if not records and not args.allow_empty:
        print("error: no PCFRF records parsed from the supplied source files", file=sys.stderr)
        return 1

    fill_missing_unique_links(records)

    written = write_records(records, args.output, args.append)
    print(f"wrote {written:,} records to {args.output}", file=sys.stderr)
    for message in summarize(records):
        print(message, file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
