from __future__ import annotations

import argparse
import csv
import json
import math
import shutil
import struct
import zipfile
from pathlib import Path


SOURCE_URL = "https://ftp.geogratis.gc.ca/pub/nrcan_rncan/vector/electoral/2000/fed301.2000.zip"
BOUNDARY_SET = "federal_ridings_1996"
EXPECTED_COUNT = 301

PROVINCES_BY_FED_PREFIX = {
    "10": {"code": "NL", "name": "Newfoundland and Labrador"},
    "11": {"code": "PE", "name": "Prince Edward Island"},
    "12": {"code": "NS", "name": "Nova Scotia"},
    "13": {"code": "NB", "name": "New Brunswick"},
    "24": {"code": "QC", "name": "Quebec"},
    "35": {"code": "ON", "name": "Ontario"},
    "46": {"code": "MB", "name": "Manitoba"},
    "47": {"code": "SK", "name": "Saskatchewan"},
    "48": {"code": "AB", "name": "Alberta"},
    "59": {"code": "BC", "name": "British Columbia"},
    "60": {"code": "YT", "name": "Yukon"},
    "61": {"code": "NT", "name": "Northwest Territories"},
    "62": {"code": "NU", "name": "Nunavut"},
}

PROVINCE_ORDER = [
    "NL",
    "PE",
    "NS",
    "NB",
    "QC",
    "ON",
    "MB",
    "SK",
    "AB",
    "BC",
    "YT",
    "NT",
    "NU",
]

OUTPUT_METADATA = {
    "source": "GeoGratis / Elections Canada",
    "sourceUrl": SOURCE_URL,
    "geometryMode": "geogratis",
}


def normalize_text(value: str) -> str:
    return " ".join(str(value or "").replace("\x97", "—").strip().split())


def load_pcfrf_names(mapping_path: Path) -> dict[str, str]:
    if not mapping_path:
        return {}

    names: dict[str, str] = {}
    with mapping_path.open(newline="", encoding="utf-8") as input_file:
        for row in csv.DictReader(input_file):
            code = normalize_riding_code(row.get("ridingCode", ""))
            name = normalize_text(row.get("ridingName", ""))
            if code and name:
                names.setdefault(code, name)

    return names


def normalize_riding_code(value: str) -> str:
    digits = "".join(character for character in str(value or "") if character.isdigit())
    if not digits or int(digits) == 0:
        return ""

    code = digits.zfill(5)
    if code == "61001":
        return "61002"

    return code


def read_dbf_records(dbf_path: Path) -> list[dict[str, str]]:
    data = dbf_path.read_bytes()
    record_count = struct.unpack("<I", data[4:8])[0]
    header_length = struct.unpack("<H", data[8:10])[0]
    record_length = struct.unpack("<H", data[10:12])[0]

    fields: list[tuple[str, int]] = []
    offset = 32
    while data[offset] != 0x0D:
        descriptor = data[offset : offset + 32]
        name = descriptor[:11].split(b"\x00", 1)[0].decode("ascii")
        length = descriptor[16]
        fields.append((name, length))
        offset += 32

    records = []
    position = header_length
    for _ in range(record_count):
        raw_record = data[position : position + record_length]
        position += record_length

        if raw_record[:1] == b"*":
            continue

        cursor = 1
        record = {}
        for name, length in fields:
            raw_value = raw_record[cursor : cursor + length]
            cursor += length
            record[name] = normalize_text(raw_value.decode("cp1252", errors="replace"))

        records.append(record)

    return records


def iter_shp_records(shp_path: Path):
    data = shp_path.read_bytes()
    position = 100

    while position < len(data):
        if position + 8 > len(data):
            break

        record_number, content_length_words = struct.unpack(">2i", data[position : position + 8])
        position += 8
        content_length = content_length_words * 2
        content = data[position : position + content_length]
        position += content_length

        if len(content) < 4:
            continue

        shape_type = struct.unpack("<i", content[:4])[0]
        if shape_type == 0:
            continue
        if shape_type != 5:
            raise ValueError(f"Unsupported shape type {shape_type} in record {record_number}")

        part_count, point_count = struct.unpack("<2i", content[36:44])
        parts_offset = 44
        points_offset = parts_offset + part_count * 4
        part_starts = list(
            struct.unpack(f"<{part_count}i", content[parts_offset:points_offset])
        )
        points = [
            struct.unpack("<2d", content[points_offset + index * 16 : points_offset + index * 16 + 16])
            for index in range(point_count)
        ]

        rings = []
        for index, start in enumerate(part_starts):
            end = part_starts[index + 1] if index + 1 < len(part_starts) else len(points)
            rings.append(points[start:end])

        yield rings


def ring_area(ring: list[tuple[float, float]]) -> float:
    if len(ring) < 3:
        return 0

    return sum(
        (left[0] * right[1]) - (right[0] * left[1])
        for left, right in zip(ring, ring[1:])
    ) / 2


def contains_point(ring: list[tuple[float, float]], point: tuple[float, float]) -> bool:
    x, y = point
    inside = False
    previous_x, previous_y = ring[-1]

    for current_x, current_y in ring:
        crosses = (current_y > y) != (previous_y > y)
        if crosses:
            x_intersect = (previous_x - current_x) * (y - current_y) / (
                previous_y - current_y
            ) + current_x
            if x < x_intersect:
                inside = not inside
        previous_x, previous_y = current_x, current_y

    return inside


class LambertConformalConic:
    def __init__(self) -> None:
        self.semimajor_axis = 6378137.0
        flattening = 1 / 298.257222101
        self.eccentricity = math.sqrt(2 * flattening - flattening * flattening)
        self.false_easting = 6200000.0
        self.false_northing = 3000000.0
        self.central_meridian = math.radians(-91.86666666666666)

        standard_parallel_1 = math.radians(49.0)
        standard_parallel_2 = math.radians(77.0)
        latitude_of_origin = math.radians(63.390675)

        m1 = self._m(standard_parallel_1)
        m2 = self._m(standard_parallel_2)
        t1 = self._t(standard_parallel_1)
        t2 = self._t(standard_parallel_2)
        t0 = self._t(latitude_of_origin)

        self.n = (math.log(m1) - math.log(m2)) / (math.log(t1) - math.log(t2))
        self.f = m1 / (self.n * (t1**self.n))
        self.rho0 = self.semimajor_axis * self.f * (t0**self.n)

    def _m(self, latitude: float) -> float:
        return math.cos(latitude) / math.sqrt(
            1 - (self.eccentricity**2) * (math.sin(latitude) ** 2)
        )

    def _t(self, latitude: float) -> float:
        sin_latitude = math.sin(latitude)
        ratio = (1 - self.eccentricity * sin_latitude) / (
            1 + self.eccentricity * sin_latitude
        )
        return math.tan(math.pi / 4 - latitude / 2) / (
            ratio ** (self.eccentricity / 2)
        )

    def to_lon_lat(self, x: float, y: float) -> tuple[float, float]:
        adjusted_x = x - self.false_easting
        adjusted_y = self.rho0 - (y - self.false_northing)
        rho = math.copysign(math.hypot(adjusted_x, adjusted_y), self.n)
        theta = math.atan2(adjusted_x, adjusted_y)
        t = (rho / (self.semimajor_axis * self.f)) ** (1 / self.n)
        longitude = self.central_meridian + theta / self.n
        latitude = math.pi / 2 - 2 * math.atan(t)

        for _ in range(8):
            sin_latitude = math.sin(latitude)
            ratio = (1 - self.eccentricity * sin_latitude) / (
                1 + self.eccentricity * sin_latitude
            )
            latitude = math.pi / 2 - 2 * math.atan(
                t * (ratio ** (self.eccentricity / 2))
            )

        return (round(math.degrees(longitude), 6), round(math.degrees(latitude), 6))


def orient_ring(
    ring: list[tuple[float, float]], *, clockwise: bool
) -> list[tuple[float, float]]:
    area = ring_area(ring)
    is_clockwise = area < 0
    if is_clockwise != clockwise:
        return list(reversed(ring))
    return ring


def close_ring(ring: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if not ring:
        return ring
    if ring[0] == ring[-1]:
        return ring
    return [*ring, ring[0]]


def build_geometry(rings: list[list[tuple[float, float]]], transformer: LambertConformalConic):
    outer_rings = []
    hole_rings = []

    for ring in rings:
        closed_projected = close_ring(ring)
        area = ring_area(closed_projected)
        if abs(area) < 1:
            continue

        transformed = [transformer.to_lon_lat(x, y) for x, y in closed_projected]
        record = {
            "projected": closed_projected,
            "coordinates": transformed,
            "area": area,
        }

        if area < 0:
            outer_rings.append(record)
        else:
            hole_rings.append(record)

    if not outer_rings:
        outer_rings = hole_rings
        hole_rings = []

    polygons = []
    for outer in sorted(outer_rings, key=lambda item: abs(item["area"]), reverse=True):
        outer_coordinates = orient_ring(outer["coordinates"], clockwise=False)
        polygons.append(
            {
                "projected": outer["projected"],
                "area": abs(outer["area"]),
                "rings": [outer_coordinates],
            }
        )

    for hole in hole_rings:
        point = hole["projected"][0]
        candidates = [
            polygon
            for polygon in polygons
            if contains_point(polygon["projected"], point)
        ]
        if not candidates:
            polygons.append(
                {
                    "projected": hole["projected"],
                    "area": abs(hole["area"]),
                    "rings": [orient_ring(hole["coordinates"], clockwise=False)],
                }
            )
            continue

        smallest_container = min(candidates, key=lambda item: item["area"])
        smallest_container["rings"].append(
            orient_ring(hole["coordinates"], clockwise=True)
        )

    return {
        "type": "MultiPolygon",
        "coordinates": [polygon["rings"] for polygon in polygons],
    }


def get_province(code: str) -> dict[str, str]:
    province = PROVINCES_BY_FED_PREFIX.get(code[:2])
    if not province:
        raise ValueError(f"Cannot infer province for riding code {code}")
    return province


def build_features(source_dir: Path, names_by_code: dict[str, str]):
    records = read_dbf_records(source_dir / "fed301_bndy.dbf")
    shapes = list(iter_shp_records(source_dir / "fed301_bndy.shp"))

    if len(records) != len(shapes):
        raise ValueError(f"DBF record count {len(records)} does not match SHP shape count {len(shapes)}")

    transformer = LambertConformalConic()
    features = []

    for record, rings in zip(records, shapes):
        code = normalize_riding_code(record.get("FED_NUM", ""))
        if not code:
            continue

        province = get_province(code)
        name = names_by_code.get(code) or normalize_text(record.get("FED_NAME", ""))

        features.append(
            {
                "type": "Feature",
                "id": code,
                "properties": {
                    "code": code,
                    "fednum": code,
                    "name": name,
                    "provinceCode": province["code"],
                    "provinceName": province["name"],
                    "boundarySet": BOUNDARY_SET,
                    "population": 0,
                    "sourceUrl": SOURCE_URL,
                },
                "geometry": build_geometry(rings, transformer),
            }
        )

    features.sort(key=lambda feature: feature["properties"]["code"])
    return features


def feature_collection(features: list[dict], metadata: dict) -> dict:
    return {
        "type": "FeatureCollection",
        "metadata": metadata,
        "features": features,
    }


def province_sort_key(province_code: str) -> tuple[int, str]:
    if province_code in PROVINCE_ORDER:
        return (PROVINCE_ORDER.index(province_code), province_code)
    return (len(PROVINCE_ORDER), province_code)


def write_outputs(features: list[dict], source_zip: Path, args: argparse.Namespace) -> None:
    source_output_dir = args.source_output_dir
    riding_output_dir = args.riding_output_dir
    boundary_output_dir = riding_output_dir / BOUNDARY_SET
    generated_at = args.generated_at

    source_output_dir.mkdir(parents=True, exist_ok=True)
    boundary_output_dir.mkdir(parents=True, exist_ok=True)

    source_zip_target = source_output_dir / source_zip.name
    if source_zip.resolve() != source_zip_target.resolve():
        shutil.copyfile(source_zip, source_zip_target)

    source_collection_path = source_output_dir / "federal_ridings_1996.geojson"
    source_collection_path.write_text(
        json.dumps(
            feature_collection(
                features,
                {
                    "boundarySet": BOUNDARY_SET,
                    **OUTPUT_METADATA,
                    "generatedAt": generated_at,
                },
            ),
            separators=(",", ":"),
        )
        + "\n",
        encoding="utf-8",
    )

    grouped: dict[str, list[dict]] = {}
    for feature in features:
        province_code = feature["properties"]["provinceCode"]
        grouped.setdefault(province_code, []).append(feature)

    provinces = {}
    for province_code in sorted(grouped.keys(), key=province_sort_key):
        province_features = grouped[province_code]
        province = get_province(province_features[0]["properties"]["code"])
        file_name = f"{province_code}.json"
        public_path = f"/data/ridings/{BOUNDARY_SET}/{file_name}"
        collection = feature_collection(
            province_features,
            {
                "boundarySet": BOUNDARY_SET,
                "provinceCode": province_code,
                "provinceName": province["name"],
                **OUTPUT_METADATA,
                "generatedAt": generated_at,
            },
        )
        (boundary_output_dir / file_name).write_text(
            json.dumps(collection, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
        provinces[province_code] = {
            "name": province["name"],
            "file": file_name,
            "publicPath": public_path,
            "featureCount": len(province_features),
        }

    manifest_path = riding_output_dir / "manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    else:
        manifest = {"version": 1, "boundarySets": {}}

    manifest["version"] = manifest.get("version") or 1
    manifest["generatedAt"] = generated_at
    manifest["source"] = "OpenNorth Represent API; GeoGratis / Elections Canada"
    manifest.setdefault("boundarySets", {})
    manifest["boundarySets"][BOUNDARY_SET] = {
        "label": "1997–2003 · 1996 Riding Map",
        "shortLabel": "1996 Map",
        "validFromYear": 1997,
        "validToYear": 2003,
        "expectedCount": EXPECTED_COUNT,
        "featureCount": len(features),
        **OUTPUT_METADATA,
        "generatedAt": generated_at,
        "provinces": provinces,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def extract_source_zip(source_zip: Path, extract_dir: Path) -> Path:
    if extract_dir.exists():
        shutil.rmtree(extract_dir)
    extract_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(source_zip) as archive:
        archive.extractall(extract_dir)

    required = [
        extract_dir / "fed301_bndy.shp",
        extract_dir / "fed301_bndy.dbf",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing required shapefile members: {', '.join(missing)}")

    return extract_dir


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Normalize GeoGratis FED 301 shapefile into 1996 riding GeoJSON files."
    )
    parser.add_argument("--source-zip", required=True, type=Path)
    parser.add_argument(
        "--pcfrf-mapping",
        type=Path,
        default=Path("data/reference/postal_riding_mappings_1996_nov01.csv"),
    )
    parser.add_argument(
        "--source-output-dir",
        type=Path,
        default=Path("data/geogratis-ridings"),
    )
    parser.add_argument(
        "--riding-output-dir",
        type=Path,
        default=Path("client/public/data/ridings"),
    )
    parser.add_argument(
        "--work-dir",
        type=Path,
        default=Path("/private/tmp/fed301_geojson_work"),
    )
    parser.add_argument(
        "--generated-at",
        default="2026-07-10T22:15:00.000Z",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source_dir = extract_source_zip(args.source_zip, args.work_dir)
    names_by_code = load_pcfrf_names(args.pcfrf_mapping)
    features = build_features(source_dir, names_by_code)

    codes = {feature["properties"]["code"] for feature in features}
    if len(features) != EXPECTED_COUNT:
        raise ValueError(f"Expected {EXPECTED_COUNT} features; generated {len(features)}")
    if len(codes) != EXPECTED_COUNT:
        raise ValueError(f"Expected {EXPECTED_COUNT} unique codes; generated {len(codes)}")

    write_outputs(features, args.source_zip, args)

    province_counts: dict[str, int] = {}
    for feature in features:
        province_code = feature["properties"]["provinceCode"]
        province_counts[province_code] = province_counts.get(province_code, 0) + 1

    print(f"Generated {len(features)} features for {BOUNDARY_SET}")
    for province_code in sorted(province_counts, key=province_sort_key):
        print(f"{province_code}: {province_counts[province_code]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
