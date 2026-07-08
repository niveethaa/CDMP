# Data Package Guide

Large data files are intentionally excluded from GitHub and Docker images. Share
them separately through Google Drive or another large-file storage service.

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
data/open-north-ridings/
```

OpenNorth riding source GeoJSON and metadata used to regenerate public riding
JSON files and seed riding region data.

```text
pcrf_normalization/pcfrf_source_manifest.csv
```

Manifest describing the PCFRF source files used to generate
`postal_riding_mappings.csv`. Keep it with the shared data artifacts.

## Not Stored in Git

- `data/`
- `mongo-dump/`
- `*.archive`
- `*.bson`
- generated `postal_riding*` CSV files
- PCFRF source zip files

The frontend static JSON files under `client/public/data/` are small enough to
stay in Git and are served by the client container.
