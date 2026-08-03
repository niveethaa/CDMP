# Data Package Guide

Large data files are intentionally excluded from GitHub and Docker images. They
are shared separately through Google Drive.

The current upload package is:

```text
course-project-nacss-drive-upload-2026-07-10.zip
```

Download the data package from Google Drive:

[Download `course-project-nacss-drive-upload-2026-07-10.zip`](https://drive.google.com/file/d/1xQCDA2nmejBIbpYF7N54gwZZ8EDKnb5G/view?usp=drive_link)

Unzip it from the project root so the paths below land in the expected places:

```bash
unzip -n course-project-nacss-drive-upload-2026-07-10.zip
```

## Required for Fast Restore

```text
mongo-dump/course_project_nacss.archive
```

This is the preferred professor/demo path. Restore it into the Docker MongoDB
container with the command in `DOCKER.md`.

## Required for Full Rebuild

```text
data/donation/raw/
```

Raw federal donation CSV files by year and party. These are read by
`server/src/scripts/importDonations.js`.

```text
data/reference/postal_riding_mappings.csv
```

Generated postal-code-to-riding mappings. This file is read by
`server/src/scripts/importPostalRidingMappings.js`.

```text
data/reference/postal_riding_mapping_sources.csv
```

Manifest describing the PCFRF source files used to generate
`postal_riding_mappings.csv`.

```text
data/pcfrf-sources/
```

PCFRF source files used by `pcrf_normalization/normalize_pcfrf.py`.

Expected files:

```text
data/pcfrf-sources/pcfrfnatfed308_sep06_fcpcefnatcef308.zip
data/pcfrf-sources/PCFRF_FCPCF_V2212_2021.zip
data/pcfrf-sources/doi-10.5683-sp4-v748yy.zip
data/pcfrf-sources/pcfrnat_nov01.txt
```

```text
data/open-north-ridings/
```

OpenNorth riding source GeoJSON and metadata used to regenerate public riding
JSON files and seed riding region data.

```text
data/geogratis-ridings/
```

GeoGratis / Elections Canada source data for the 1996 federal riding geometry.
Expected files:

```text
data/geogratis-ridings/fed301.2000.zip
data/geogratis-ridings/federal_ridings_1996.geojson
```

```text
client/public/data/ridings/
```

Frontend-ready riding GeoJSON split by boundary set and province. The 1996
files are generated from `data/geogratis-ridings/fed301.2000.zip`; the 2003 and
2013 files are generated from OpenNorth source data.

## Rebuild Notes

The uploaded zip includes generated files, so a full rebuild does not require
manual downloads. Run commands from the repository root after extracting the
zip.

The data importer container mounts both `data/` and
`client/public/data/ridings/`, so regenerated reference CSVs and riding GeoJSON
persist on the host.

If you need to prove postal-riding mapping regeneration:

```bash
docker compose run --rm data-importer \
  python3 /app/pcrf_normalization/normalize_pcfrf.py \
  --source "federal_ridings_1996,2001-11,PCFRF_1996_NOV01,/data/pcfrf-sources/pcfrnat_nov01.txt" \
  --source "federal_ridings_2003,2006-09,PCFRF_2003_SEP06,/data/pcfrf-sources/pcfrfnatfed308_sep06_fcpcefnatcef308.zip" \
  --source "federal_ridings_2013,2022-12,PCFRF_2013_V2212,/data/pcfrf-sources/PCFRF_FCPCF_V2212_2021.zip" \
  --source "federal_ridings_2023,2026-06,PCFRF_2023_V2606,/data/pcfrf-sources/doi-10.5683-sp4-v748yy.zip" \
  --output /data/reference/postal_riding_mappings.csv
```

The `postal_riding_mappings_1996_nov01.csv` slice is included in the upload
package because the 1996 riding GeoJSON normalizer uses it for canonical riding
names.

If you need to prove 1996 riding GeoJSON regeneration:

```bash
docker compose run --rm data-importer \
  python3 /app/pcrf_normalization/normalize_fed301_geojson.py \
  --source-zip /data/geogratis-ridings/fed301.2000.zip \
  --pcfrf-mapping /data/reference/postal_riding_mappings_1996_nov01.csv \
  --source-output-dir /data/geogratis-ridings \
  --riding-output-dir /app/client/public/data/ridings
```

The 1996 source is the GeoGratis / Elections Canada `fed301.2000.zip`
shapefile. The normalizer converts it to WGS84 GeoJSON, maps Western Arctic
from source code `61001` to PCFRF code `61002`, and drops the blank `FED_NUM = 0`
feature.

Expected final data checks:

```text
Donation records: 5374039
modern: 5133100
pre_2004: 240939
Postal-riding mappings: 3347996
Donation riding assignments: 5374039
Riding Regions by Boundary Set:
  federal_ridings_1996: 301
  federal_ridings_2003: 308
  federal_ridings_2013: 338
  federal_ridings_2023: 343
```

## Not Stored in Git

- `data/`
- `mongo-dump/`
- `*.archive`
- `*.bson`
- Generated `postal_riding*` CSV files
- PCFRF source ZIP files
- GeoGratis riding source ZIP files

The frontend static JSON files under `client/public/data/` are small enough to
stay in Git and are served by the client container.
