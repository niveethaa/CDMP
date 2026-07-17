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

PCFRF source ZIP files used by `pcrf_normalization/normalize_pcfrf.py`.

Expected files:

```text
data/pcfrf-sources/pcfrfnatfed308_sep06_fcpcefnatcef308.zip
data/pcfrf-sources/PCFRF_FCPCF_V2212_2021.zip
data/pcfrf-sources/doi-10.5683-sp4-v748yy.zip
```

```text
data/open-north-ridings/
```

OpenNorth riding source GeoJSON and metadata used to regenerate public riding
JSON files and seed riding region data.

## Not Stored in Git

- `data/`
- `mongo-dump/`
- `*.archive`
- `*.bson`
- Generated `postal_riding*` CSV files
- PCFRF source ZIP files

The frontend static JSON files under `client/public/data/` are small enough to
stay in Git and are served by the client container.
