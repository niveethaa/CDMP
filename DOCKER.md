# Docker Handoff Guide

This setup is intended for local grading, demo, and reproducible handoff. GitHub
contains the application code and Docker configuration. Large data artifacts stay
outside GitHub and should be shared separately, for example through Google Drive.
The Docker setup uses a local MongoDB container instead of MongoDB Atlas.

## Prerequisites

- Docker Desktop
- A MongoDB dump archive from the shared data folder
- Optional raw data files if rebuilding the database from source

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

3. Download the MongoDB dump from Google Drive and place it here:

   ```text
   mongo-dump/course_project_nacss.archive
   ```

   This archive is large and should stay in Google Drive, not GitHub.

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
   Donation records: 5133100
   Region stats: 6802
   Postal-riding mappings: 2583570
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

1. Download raw data from Google Drive into:

   ```text
   data/donation/raw/
   data/open-north-ridings/
   ```

2. Generate or download the postal-riding mapping file.

   The backend importer expects:

   ```text
   data/reference/postal_riding_mappings.csv
   ```

   To regenerate it with the Python normalizer, run `data-importer` with the
   source PCFRF zip/text files mounted under `data/` or another local path.
   The normalizer accepts one or more `--source` arguments:

   ```bash
   docker compose run --rm data-importer \
     python3 /app/pcrf_normalization/normalize_pcfrf.py \
     --source "federal_ridings_2013,2022-12,PCFRF_FCPCF_V2212_2021,/data/path-to-source.zip" \
     --output /data/reference/postal_riding_mappings.csv
   ```

   Replace the sample source path with the actual downloaded PCFRF file. Use
   the manifest from the data package to identify the exact source files.

3. Import and build the database.

   ```bash
   docker compose run --rm data-importer npm run seed:parties
   docker compose run --rm data-importer npm run seed:regions
   docker compose run --rm data-importer npm run seed:boundary-sets
   docker compose run --rm data-importer npm run seed:riding-regions
   docker compose run --rm data-importer npm run import:postal-riding-mappings
   docker compose run --rm data-importer npm run import:donations -- --all
   docker compose run --rm data-importer npm run match:donations-to-ridings
   docker compose run --rm data-importer npm run build:region-stats
   docker compose run --rm data-importer npm run build:timeline-region-stats
   docker compose run --rm data-importer npm run check:data
   ```

4. Optionally create a new dump after a successful rebuild.

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
  raw/
    donation/
      raw/
        2004/
        2005/
        ...
        PRE2004/
    open-north-ridings/
  generated/
    postal_riding_mappings.csv
    pcfrf_source_manifest.csv
  README_DATA.md
```

Google Drive links:

- Mongo dump: `<insert Google Drive link>`
- Raw donation and riding data: `<insert Google Drive link>`
- Generated postal-riding mapping files: `<insert Google Drive link>`

## Troubleshooting

- If restore fails with `archive not found`, confirm the file is at `mongo-dump/course_project_nacss.archive`.
- If map or dashboard APIs return empty data, restore the Mongo dump or run the full import pipeline.
- If `import:postal-riding-mappings` fails, confirm `data/reference/postal_riding_mappings.csv` exists.
- If Docker build fails in `client`, run `cd client && npm install` locally to refresh missing dependencies, then rebuild.
- If you need to reset all imported data, run `docker compose down -v` and restore the dump again.
