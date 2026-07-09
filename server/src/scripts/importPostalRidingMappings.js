const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { parse } = require("csv-parse");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const connectDB = require("../config/db");
const PostalRidingMapping = require("../models/PostalRidingMapping");
const Region = require("../models/Region");
const ReferenceDataBatch = require("../models/ReferenceDataBatch");

const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const DEFAULT_MAPPING_FILE = path.join(
  PROJECT_ROOT,
  "data",
  "reference",
  "postal_riding_mappings.csv",
);
const DOCKER_MAPPING_FILE = path.join(
  "/data",
  "reference",
  "postal_riding_mappings.csv",
);

const BULK_WRITE_SIZE = 1000;
const REFERENCE_TYPE = "postal_riding_mapping";

const CSV_OPTIONS = {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  bom: true,
};

const TRUE_VALUES = new Set(["1", "true", "yes"]);

const REQUIRED_FIELDS = [
  "boundarySet",
  "postalCode",
  "fsa",
  "provinceCode",
  "ridingCode",
  "ridingName",
];

function getArgValue(flagName) {
  const index = process.argv.indexOf(flagName);
  return index === -1 ? null : process.argv[index + 1] || null;
}

function getMappingFilePath() {
  if (process.env.POSTAL_RIDING_MAPPING_FILE) {
    return path.resolve(process.env.POSTAL_RIDING_MAPPING_FILE);
  }

  if (fs.existsSync(DEFAULT_MAPPING_FILE)) {
    return DEFAULT_MAPPING_FILE;
  }

  if (fs.existsSync(DOCKER_MAPPING_FILE)) {
    return DOCKER_MAPPING_FILE;
  }

  return DEFAULT_MAPPING_FILE;
}

function cleanString(value) {
  return String(value || "").trim();
}

function normalizePostalCode(value) {
  return cleanString(value)
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function parseWeight(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseUniqueLink(value) {
  return TRUE_VALUES.has(cleanString(value).toLowerCase());
}

function buildMappingRow(row) {
  const postalCode = normalizePostalCode(row.postalCode);

  return {
    postalCode,
    fsa: cleanString(row.fsa || postalCode.slice(0, 3)).toUpperCase(),
    provinceCode: cleanString(row.provinceCode).toUpperCase(),
    boundarySet: cleanString(row.boundarySet),
    ridingCode: cleanString(row.ridingCode),
    ridingName: cleanString(row.ridingName),
    uniqueLink: parseUniqueLink(row.uniqueLink),
    weight: parseWeight(row.weight),
    sourceFile: cleanString(row.sourceFile),
    referenceDate: cleanString(row.referenceDate),
  };
}

function validateMappingRow(row) {
  return REQUIRED_FIELDS.filter((field) => !row[field]);
}

function createCandidate({ ridingCode, ridingName, provinceCode, weight }) {
  return {
    ridingCode,
    ridingName,
    provinceCode,
    weight: weight || 0,
  };
}

function buildMappingBulkOperation(row) {
  const {
    postalCode,
    fsa,
    provinceCode,
    boundarySet,
    sourceFile,
    referenceDate,
    uniqueLink,
  } = row;

  return {
    updateOne: {
      filter: { postalCode, boundarySet },
      update: {
        $setOnInsert: {
          postalCode,
          fsa,
          provinceCode,
          boundarySet,
        },
        $set: {
          source: sourceFile,
          sourceFile,
          referenceDate,
          uniqueLink,
        },
        $addToSet: {
          candidates: createCandidate(row),
        },
      },
      upsert: true,
    },
  };
}

function buildRegionBulkOperation({
  ridingCode,
  ridingName,
  provinceCode,
  boundarySet,
}) {
  return {
    updateOne: {
      filter: {
        level: "riding",
        code: ridingCode,
        boundarySet,
      },
      update: {
        $set: {
          level: "riding",
          code: ridingCode,
          name: ridingName,
          provinceCode,
          provinceName: "",
          boundarySet,
          geometryRef: "",
          populationHistory: [],
        },
        $unset: {
          centroid: "",
        },
      },
      upsert: true,
    },
  };
}

function buildBatchKey(row) {
  return `${row.boundarySet}|${row.sourceFile || "unknown_source"}`;
}

function getOrCreateBatch(batchStats, row, sourcePath) {
  const batchKey = buildBatchKey(row);

  if (!batchStats.has(batchKey)) {
    batchStats.set(batchKey, {
      fileName: row.sourceFile || path.basename(sourcePath),
      sourcePath,
      boundarySet: row.boundarySet || "unknown_boundary_set",
      rowCount: 0,
      importedCount: 0,
      skippedCount: 0,
    });
  }

  return batchStats.get(batchKey);
}

async function flushBulkOperations(Model, operations) {
  if (!operations.length) return;

  await Model.bulkWrite(operations, { ordered: false });
  operations.length = 0;
}

function getMatchStatus(candidateCount) {
  if (candidateCount === 1) return "unique";
  if (candidateCount > 1) return "ambiguous";
  return "unmatched";
}

async function updateMappingStatuses(boundarySets) {
  console.log("Updating mapping candidate counts and statuses...");

  for (const boundarySet of boundarySets) {
    const cursor = PostalRidingMapping.find({ boundarySet }).cursor();
    const operations = [];

    for await (const mapping of cursor) {
      const candidateCount = mapping.candidates.length;

      operations.push({
        updateOne: {
          filter: { _id: mapping._id },
          update: {
            $set: {
              candidateCount,
              matchStatus: getMatchStatus(candidateCount),
            },
          },
        },
      });

      if (operations.length >= BULK_WRITE_SIZE) {
        await flushBulkOperations(PostalRidingMapping, operations);
      }
    }

    await flushBulkOperations(PostalRidingMapping, operations);
  }
}

async function updateReferenceBatches(batchStats) {
  for (const batch of batchStats.values()) {
    await ReferenceDataBatch.findOneAndUpdate(
      {
        fileName: batch.fileName,
        referenceType: REFERENCE_TYPE,
        boundarySet: batch.boundarySet,
      },
      {
        $set: {
          ...batch,
          referenceType: REFERENCE_TYPE,
          status: "completed",
          errorMessage: "",
        },
      },
      {
        upsert: true,
        new: true,
      },
    );
  }
}

async function importPostalRidingMappings(filePath) {
  const resolvedFilePath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(resolvedFilePath)) {
    throw new Error(
      `Postal-riding mapping file not found: ${resolvedFilePath}`,
    );
  }

  console.log(`Importing postal-riding mappings from ${resolvedFilePath}`);

  const boundarySets = new Set();
  const ridingRegionKeys = new Set();
  const batchStats = new Map();

  const mappingOperations = [];
  const regionOperations = [];

  let rowCount = 0;
  let importedCount = 0;
  let skippedCount = 0;

  const parser = fs.createReadStream(resolvedFilePath).pipe(parse(CSV_OPTIONS));

  for await (const rawRow of parser) {
    rowCount += 1;

    const row = buildMappingRow(rawRow);
    const missingFields = validateMappingRow(row);
    const batch = getOrCreateBatch(batchStats, row, resolvedFilePath);

    batch.rowCount += 1;

    if (missingFields.length) {
      skippedCount += 1;
      batch.skippedCount += 1;

      if (skippedCount <= 10) {
        console.warn(
          `Skipping row ${rowCount}: missing ${missingFields.join(", ")}`,
        );
      }

      continue;
    }

    boundarySets.add(row.boundarySet);

    const ridingRegionKey = `${row.boundarySet}|${row.ridingCode}`;

    if (!ridingRegionKeys.has(ridingRegionKey)) {
      ridingRegionKeys.add(ridingRegionKey);
      regionOperations.push(buildRegionBulkOperation(row));
    }

    mappingOperations.push(buildMappingBulkOperation(row));

    importedCount += 1;
    batch.importedCount += 1;

    if (mappingOperations.length >= BULK_WRITE_SIZE) {
      await flushBulkOperations(PostalRidingMapping, mappingOperations);
    }

    if (regionOperations.length >= BULK_WRITE_SIZE) {
      await flushBulkOperations(Region, regionOperations);
    }

    if (rowCount % 100000 === 0) {
      console.log(`Processed ${rowCount} rows...`);
    }
  }

  await flushBulkOperations(PostalRidingMapping, mappingOperations);
  await flushBulkOperations(Region, regionOperations);

  await updateMappingStatuses(boundarySets);
  await updateReferenceBatches(batchStats);

  console.log("\nPostal-riding mapping import complete.");
  console.log(`Rows read: ${rowCount}`);
  console.log(`Imported mapping rows: ${importedCount}`);
  console.log(`Skipped rows: ${skippedCount}`);
  console.log(`Boundary sets found: ${Array.from(boundarySets).join(", ")}`);
  console.log(`Distinct riding regions seeded: ${ridingRegionKeys.size}`);
}

async function main() {
  try {
    await connectDB();

    const filePath = getArgValue("--file") || getMappingFilePath();

    await importPostalRidingMappings(filePath);
  } catch (error) {
    console.error("Postal-riding mapping import failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildMappingRow,
  validateMappingRow,
  createCandidate,
  importPostalRidingMappings,
};
