# Docker Handoff Guide

This setup is intended for local grading, demo, and reproducible handoff. GitHub
contains the application code and Docker configuration. Large data artifacts stay
outside GitHub and should be shared separately, for example through Google Drive.
The Docker setup uses a local MongoDB container instead of MongoDB Atlas.

## Prerequisites

- Docker Desktop
- The Google Drive upload zip, which contains the MongoDB dump and raw data

Expected local ports:

- Frontend: `http://localhost:8080`
- Backend health check: `http://localhost:5001/api/health`
- MongoDB: internal Docker service `mongo:27017`

The Compose file pins MongoDB to `mongo:8.0` so local restores match the
MongoDB Atlas 8.0 dump source.

Docker does not require `server/.env` or a MongoDB Atlas URI. The Docker
services use the local MongoDB container configured in `docker-compose.yml`.

## Fast Setup With Mongo Dump

This is the path a professor should use for grading or demo.

1. Install and open Docker Desktop.

2. Clone the repository.

   ```bash
   git clone <repo-url>
   cd course-project-nacss
   ```

3. Download `course-project-nacss-drive-upload-2026-07-10.zip` from Google
   Drive into the project root and unzip it.

   ```bash
   unzip -n course-project-nacss-drive-upload-2026-07-10.zip
   ```

   After unzipping, this file should exist:

   ```text
   mongo-dump/course_project_nacss.archive
   ```

   The zip and archive are large and should stay in Google Drive, not GitHub.

4. Start the containers.

   ```bash
   docker compose up --build -d
   ```

5. Restore the MongoDB dump.

   ```bash
   docker compose run --rm mongo-tools mongorestore --host mongo --drop --archive=/dump/course_project_nacss.archive
   ```

6. Confirm the restore.

   ```bash
   docker compose --profile tools run --rm data-importer npm run check:data
   ```

   Expected key counts:

   ```text
   Donation records: 5374039
   Donation Records by Data Era:
     modern: 5133100
     pre_2004: 240939
   Region stats: 8159
   Postal-riding mappings: 3347996
   Donation riding assignments: 5374039
   ```

7. Open the app.

   ```text
   http://localhost:8080
   ```

8. Check the backend.

   ```text
   http://localhost:5001/api/health
   ```

9. Stop the app when finished.

   ```bash
   docker compose down
   ```

## Full Data Rebuild Path

Use this path only when you need to prove or rerun the source-data pipeline.
The fast Mongo dump restore is the recommended grading/demo path.

The `data-importer` service mounts both `./data` and
`./client/public/data/ridings`, so regenerated mapping CSVs and riding GeoJSON
persist in the working tree.

1. Download and unzip `course-project-nacss-drive-upload-2026-07-10.zip` into
   the project root.

   ```bash
   unzip -n course-project-nacss-drive-upload-2026-07-10.zip
   ```

   The unzipped package should provide:

   ```text
   data/donation/raw/
   data/open-north-ridings/
   data/geogratis-ridings/
   data/pcfrf-sources/
   data/reference/postal_riding_mappings.csv
   data/reference/postal_riding_mapping_sources.csv
   data/reference/postal_riding_mappings_1996_nov01.csv
   client/public/data/ridings/
   ```

2. Use or regenerate the postal-riding mapping file.

   The backend importer expects:

   ```text
   data/reference/postal_riding_mappings.csv
   data/reference/postal_riding_mapping_sources.csv
   ```

   The zip already includes `postal_riding_mappings.csv`, so this step can be
   skipped unless you want to prove the Python normalization step. To regenerate
   the CSV from the included PCFRF source files:

   ```bash
   docker compose run --rm data-importer \
     python3 /app/pcrf_normalization/normalize_pcfrf.py \
     --source "federal_ridings_1996,2001-11,PCFRF_1996_NOV01,/data/pcfrf-sources/pcfrnat_nov01.txt" \
     --source "federal_ridings_2003,2006-09,PCFRF_2003_SEP06,/data/pcfrf-sources/pcfrfnatfed308_sep06_fcpcefnatcef308.zip" \
     --source "federal_ridings_2013,2022-12,PCFRF_2013_V2212,/data/pcfrf-sources/PCFRF_FCPCF_V2212_2021.zip" \
     --source "federal_ridings_2023,2026-06,PCFRF_2023_V2606,/data/pcfrf-sources/doi-10.5683-sp4-v748yy.zip" \
     --output /data/reference/postal_riding_mappings.csv
   ```

   `data/reference/postal_riding_mapping_sources.csv` records the source files
   and normalization notes.

3. Regenerate riding GeoJSON if needed.

   The zip already includes public riding GeoJSON under
   `client/public/data/ridings/`. To regenerate the 1996 riding map from the
   included GeoGratis source:

   ```bash
   docker compose run --rm data-importer \
     python3 /app/pcrf_normalization/normalize_fed301_geojson.py \
     --source-zip /data/geogratis-ridings/fed301.2000.zip \
     --pcfrf-mapping /data/reference/postal_riding_mappings_1996_nov01.csv \
     --source-output-dir /data/geogratis-ridings \
     --riding-output-dir /app/client/public/data/ridings
   ```

   The GeoGratis file uses `61001` for Western Arctic; normalization maps it to
   the PCFRF code `61002` and drops the blank `FED_NUM = 0` feature.

4. Reset the local MongoDB volume if you are rebuilding from scratch.

   ```bash
   docker compose down -v
   docker compose up --build -d mongo
   ```

5. Import and build the database.

   ```bash
   docker compose run --rm data-importer npm run seed:parties
   docker compose run --rm data-importer npm run seed:regions
   docker compose run --rm data-importer npm run seed:boundary-sets
   docker compose run --rm data-importer npm run seed:riding-regions
   docker compose run --rm data-importer npm run import:postal-riding-mappings
   docker compose run --rm data-importer npm run import:donations -- --all
   docker compose run --rm data-importer npm run match:donations-to-ridings -- --all
   docker compose run --rm data-importer npm run build:region-stats
   docker compose run --rm data-importer npm run build:timeline-region-stats
   docker compose run --rm data-importer npm run check:data
   ```

   A full rebuild imports the canonical `data/donation/raw/PRE2004/` CSV files
   in addition to the 2004-2024 yearly files. With the current raw package, the
   donation record count should be `5,374,039`, and the postal-riding mapping
   CSV should contain `3,358,807` mapping rows plus the header. Riding regions
   should report `301` records for `federal_ridings_1996`.

6. Optionally create a new dump after a successful rebuild.

   ```bash
   docker compose exec mongo mongodump --archive=/tmp/course_project_nacss.archive --db course_project_nacss
   docker cp "$(docker compose ps -q mongo)":/tmp/course_project_nacss.archive ./mongo-dump/course_project_nacss.archive
   ```

## Google Drive Data Package

Use this layout for the shared data folder:

```text
course-project-nacss-data/
  mongo-dump/
    course_project_nacss.archive
  data/
    donation/
      raw/
        PRE2004/
        2004/
        2005/
        ...
    open-north-ridings/
    geogratis-ridings/
    reference/
      postal_riding_mappings.csv
      postal_riding_mapping_sources.csv
      postal_riding_mappings_1996_nov01.csv
    pcfrf-sources/
      pcfrnat_nov01.txt
      pcfrfnatfed308_sep06_fcpcefnatcef308.zip
      PCFRF_FCPCF_V2212_2021.zip
      doi-10.5683-sp4-v748yy.zip
  client/
    public/
      data/
        ridings/
  pcrf_normalization/
    normalize_pcfrf.py
    normalize_fed301_geojson.py
  DOCKER.md
  DATA_README.md
```

The current upload package is:

```text
course-project-nacss-drive-upload-2026-07-10.zip
```

It contains:

```text
mongo-dump/course_project_nacss.archive
data/donation/raw/
data/open-north-ridings/
data/geogratis-ridings/
data/reference/
data/pcfrf-sources/
client/public/data/ridings/
pcrf_normalization/
DOCKER.md
DATA_README.md
```

The generated reference and public riding files are:

```text
data/reference/
    postal_riding_mappings.csv
    postal_riding_mapping_sources.csv
    postal_riding_mappings_1996_nov01.csv
data/geogratis-ridings/
    fed301.2000.zip
    federal_ridings_1996.geojson
client/public/data/ridings/
    manifest.json
    federal_ridings_1996/
```

Google Drive links:

- Full data package zip: `<insert Google Drive link>`

## Refreshing the Upload Package

After a successful local rebuild, refresh the Mongo dump and zip from the
repository root:

```bash
mkdir -p mongo-dump
docker compose exec mongo mongodump --archive=/tmp/course_project_nacss.archive --db course_project_nacss
docker cp "$(docker compose ps -q mongo)":/tmp/course_project_nacss.archive ./mongo-dump/course_project_nacss.archive
zip -r -q course-project-nacss-drive-upload-2026-07-10.zip \
  mongo-dump/course_project_nacss.archive \
  data/donation/raw \
  data/open-north-ridings \
  data/geogratis-ridings \
  data/reference \
  data/pcfrf-sources \
  client/public/data/ridings \
  pcrf_normalization \
  DOCKER.md \
  DATA_README.md \
  -x '**/.DS_Store'
zip -T course-project-nacss-drive-upload-2026-07-10.zip
```

Upload the refreshed zip to Google Drive. Do not commit the zip, raw data,
Mongo dump, or generated PCFRF files to GitHub.

## Troubleshooting

- If restore fails with `archive not found`, confirm the file is at `mongo-dump/course_project_nacss.archive`.
- If map or dashboard APIs return empty data, restore the Mongo dump or run the full import pipeline.
- If `import:postal-riding-mappings` fails, confirm `data/reference/postal_riding_mappings.csv` exists.
- If `seed:riding-regions` fails with a missing manifest, confirm `client/public/data/ridings/manifest.json` exists after unzipping the data package.
- If the full rebuild cannot find raw donation files, confirm the zip was extracted from the project root.
- If Docker build fails in `client`, run `cd client && npm install` locally to refresh missing dependencies, then rebuild.
- If you need to reset all imported data, run `docker compose down -v` and restore the dump again.
