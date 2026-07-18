const fs = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");
const mongoose = require("mongoose");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const connectDB = require("../config/db");
const BoundarySet = require("../models/BoundarySet");
const Region = require("../models/Region");

const OPENNORTH_BASE_URL = "https://represent.opennorth.ca";
const RIDING_DATA_DIR = path.resolve(
  __dirname,
  "../../../client/public/data/ridings",
);
const SOURCE_DATA_DIR = path.resolve(
  __dirname,
  "../../../data/open-north-ridings",
);

const PROVINCES_BY_FED_PREFIX = {
  10: { code: "NL", name: "Newfoundland and Labrador" },
  11: { code: "PE", name: "Prince Edward Island" },
  12: { code: "NS", name: "Nova Scotia" },
  13: { code: "NB", name: "New Brunswick" },
  24: { code: "QC", name: "Quebec" },
  35: { code: "ON", name: "Ontario" },
  46: { code: "MB", name: "Manitoba" },
  47: { code: "SK", name: "Saskatchewan" },
  48: { code: "AB", name: "Alberta" },
  59: { code: "BC", name: "British Columbia" },
  60: { code: "YT", name: "Yukon" },
  61: { code: "NT", name: "Northwest Territories" },
  62: { code: "NU", name: "Nunavut" },
};

const PROVINCE_ORDER = [
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
];

const SOURCE_DEFINITIONS = {
  federal_ridings_2003: {
    code: "federal_ridings_2003",
    label: "2004–2014 · 2003 Riding Map",
    shortLabel: "2003 Map",
    name: "Federal Ridings - 2003 Representation Order",
    slug: "federal-electoral-districts-2003-representation-order",
    expectedCount: 308,
    validFromYear: 2004,
    validToYear: 2014,
    censusYear: 2006,
    notes: "Boundary set for donation years 2004-2014 using the 2003 Representation Order riding map.",
  },
  federal_ridings_2013: {
    code: "federal_ridings_2013",
    label: "2015–2024 · 2013 Riding Map",
    shortLabel: "2013 Map",
    name: "Federal Ridings - 2013 Representation Order",
    slug: "federal-electoral-districts-2013-representation-order",
    expectedCount: 338,
    validFromYear: 2015,
    validToYear: 2024,
    censusYear: 2011,
    notes: "Boundary set for donation years 2015-2024 using the 2013 Representation Order riding map.",
  },
};

function printHelp() {
  console.log(`
Import OpenNorth federal riding GeoJSON for the 2003 and 2013 Representation Orders.

Usage:
  npm run import:opennorth-ridings -- [options]

Options:
  --mode=simple|full          Download simplified or full geometry. Default: simple.
  --set=2003|2013|all         Boundary set to import. Can repeat or comma-separate. Default: all.
  --skip-download             Reuse files already in data/open-north-ridings.
  --no-db                     Write frontend GeoJSON/manifest only; skip MongoDB upserts.
  --allow-count-mismatch      Warn instead of failing if counts differ from expected totals.
  --help                      Show this help.
`);
}

function parseArgs(argv) {
  const options = {
    mode: "simple",
    boundarySetCodes: new Set(Object.keys(SOURCE_DEFINITIONS)),
    skipDownload: false,
    noDb: false,
    allowCountMismatch: false,
    help: false,
  };
  let explicitBoundarySets = false;

  for (const argument of argv) {
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }

    if (argument === "--simple") {
      options.mode = "simple";
      continue;
    }

    if (argument === "--full") {
      options.mode = "full";
      continue;
    }

    if (argument.startsWith("--mode=")) {
      options.mode = argument.split("=").slice(1).join("=");
      continue;
    }

    if (argument === "--skip-download") {
      options.skipDownload = true;
      continue;
    }

    if (argument === "--no-db") {
      options.noDb = true;
      continue;
    }

    if (argument === "--allow-count-mismatch") {
      options.allowCountMismatch = true;
      continue;
    }

    if (argument.startsWith("--set=") || argument.startsWith("--boundary-set=")) {
      const rawValue = argument.split("=").slice(1).join("=");
      const requestedValues = rawValue.split(",").map((value) => value.trim());

      if (requestedValues.includes("all")) {
        options.boundarySetCodes = new Set(Object.keys(SOURCE_DEFINITIONS));
        explicitBoundarySets = true;
        continue;
      }

      const selectedCodes = requestedValues
        .map((value) => normalizeBoundarySetCode(value))
        .filter(Boolean);

      if (!explicitBoundarySets) {
        options.boundarySetCodes = new Set();
        explicitBoundarySets = true;
      }

      for (const code of selectedCodes) {
        options.boundarySetCodes.add(code);
      }
    }
  }

  if (!["simple", "full"].includes(options.mode)) {
    throw new Error(`Unsupported --mode value "${options.mode}". Use simple or full.`);
  }

  if (options.boundarySetCodes.size === 0) {
    throw new Error("No boundary sets selected. Use --set=2003, --set=2013, or --set=all.");
  }

  return options;
}

function normalizeBoundarySetCode(value) {
  if (!value) return null;
  if (value === "2003") return "federal_ridings_2003";
  if (value === "2013") return "federal_ridings_2013";
  if (SOURCE_DEFINITIONS[value]) return value;

  throw new Error(`Unknown boundary set "${value}". Use 2003, 2013, or all.`);
}

function getSelectedSources(boundarySetCodes) {
  return Array.from(boundarySetCodes)
    .map((code) => SOURCE_DEFINITIONS[code])
    .filter(Boolean);
}

function getShapeModeConfig(mode) {
  if (mode === "full") {
    return {
      endpoint: "shape",
      geometryProperty: "shape",
      fileSuffix: "full",
      description: "full/original",
    };
  }

  return {
    endpoint: "simple_shape",
    geometryProperty: "simple_shape",
    fileSuffix: "simple",
    description: "simplified",
  };
}

function buildMetadataUrl(source) {
  return `${OPENNORTH_BASE_URL}/boundaries/${source.slug}/?limit=${source.expectedCount}`;
}

function buildShapeUrl(source, mode) {
  const { endpoint } = getShapeModeConfig(mode);
  return `${OPENNORTH_BASE_URL}/boundaries/${source.slug}/${endpoint}?limit=${source.expectedCount}`;
}

function getSourceFilePaths(source, mode) {
  const { fileSuffix } = getShapeModeConfig(mode);

  return {
    metadata: path.join(SOURCE_DATA_DIR, `${source.code}_metadata.json`),
    shape: path.join(SOURCE_DATA_DIR, `${source.code}_${fileSuffix}.geojson`),
  };
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadWithCurl(url, destinationPath, skipDownload) {
  if (skipDownload && (await pathExists(destinationPath))) {
    console.log(`Reusing ${path.relative(process.cwd(), destinationPath)}`);
    return;
  }

  await fs.mkdir(path.dirname(destinationPath), { recursive: true });

  console.log(`Downloading ${url}`);

  await new Promise((resolve, reject) => {
    const curl = spawn(
      "curl",
      ["-L", "--fail", "--silent", "--show-error", url, "-o", destinationPath],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";

    curl.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    curl.on("error", reject);

    curl.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `curl failed for ${url} with exit code ${code}: ${stderr.trim()}`,
        ),
      );
    });
  });
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function getObjects(payload, label) {
  if (Array.isArray(payload?.objects)) return payload.objects;
  if (payload?.type === "FeatureCollection" && Array.isArray(payload.features)) {
    return payload.features;
  }

  throw new Error(`${label} does not contain an objects array or FeatureCollection.`);
}

function normalizeName(name) {
  return String(name || "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ");
}

function buildMetadataLookup(metadataObjects) {
  const lookup = new Map();

  metadataObjects.forEach((metadata, index) => {
    const key = normalizeName(metadata.name);
    const records = lookup.get(key) || [];
    records.push({ metadata, index });
    lookup.set(key, records);
  });

  return lookup;
}

function takeMatchingMetadata(shapeObject, shapeIndex, metadataObjects, metadataLookup) {
  const key = normalizeName(shapeObject.properties?.name || shapeObject.name);
  const records = metadataLookup.get(key);

  if (records?.length) {
    return records.shift().metadata;
  }

  return metadataObjects[shapeIndex];
}

function getCodeFromUrl(url) {
  const match = String(url || "").match(/\/(\d+)\/?$/);
  return match?.[1] || "";
}

function normalizeRidingCode(metadata, shapeObject) {
  const properties = shapeObject.properties || {};
  const candidates = [
    properties.code,
    properties.fednum,
    properties.external_id,
    metadata?.external_id,
    getCodeFromUrl(properties.url),
    getCodeFromUrl(metadata?.url),
  ];

  for (const candidate of candidates) {
    const digits = String(candidate || "").replace(/\D/g, "");
    if (digits) return digits.padStart(5, "0");
  }

  return "";
}

function getProvinceForRidingCode(code) {
  const province = PROVINCES_BY_FED_PREFIX[code.slice(0, 2)];

  if (!province) {
    throw new Error(`Cannot infer province for riding code ${code}.`);
  }

  return province;
}

function getGeometry(shapeObject, mode) {
  const { geometryProperty } = getShapeModeConfig(mode);

  if (shapeObject.type === "Feature") return shapeObject.geometry;

  return (
    shapeObject[geometryProperty] ||
    shapeObject.shape ||
    shapeObject.simple_shape ||
    shapeObject.geometry
  );
}

function buildFeature({ source, mode, metadata, shapeObject, shapeIndex }) {
  const geometry = getGeometry(shapeObject, mode);

  if (!geometry?.type || !Array.isArray(geometry.coordinates)) {
    throw new Error(
      `Missing geometry for ${shapeObject.name || metadata?.name || `feature ${shapeIndex}`}.`,
    );
  }

  const code = normalizeRidingCode(metadata, shapeObject);

  if (!code) {
    throw new Error(`Missing riding code for ${shapeObject.name || metadata?.name}.`);
  }

  const province = getProvinceForRidingCode(code);
  const name = normalizeName(
    shapeObject.properties?.name || shapeObject.name || metadata?.name,
  );

  return {
    type: "Feature",
    id: code,
    properties: {
      code,
      fednum: code,
      name,
      provinceCode: province.code,
      provinceName: province.name,
      boundarySet: source.code,
      population: Number(shapeObject.properties?.population || 0),
      sourceUrl: `${OPENNORTH_BASE_URL}${metadata?.url || ""}`,
    },
    geometry,
  };
}

function validateCount(actualCount, expectedCount, label, allowCountMismatch) {
  if (actualCount === expectedCount) return;

  const message = `${label} count ${actualCount} does not match expected ${expectedCount}.`;

  if (allowCountMismatch) {
    console.warn(`Warning: ${message}`);
    return;
  }

  throw new Error(message);
}

function validateUniqueCodes(features, sourceCode) {
  const seen = new Set();
  const duplicates = new Set();

  for (const feature of features) {
    const code = feature.properties.code;
    if (seen.has(code)) duplicates.add(code);
    seen.add(code);
  }

  if (duplicates.size) {
    throw new Error(
      `${sourceCode} has duplicate riding codes: ${Array.from(duplicates).join(", ")}`,
    );
  }
}

function sortFeatures(features) {
  return [...features].sort((left, right) =>
    left.properties.code.localeCompare(right.properties.code),
  );
}

function groupFeaturesByProvince(features) {
  const groups = new Map();

  for (const feature of sortFeatures(features)) {
    const provinceCode = feature.properties.provinceCode;
    const provinceFeatures = groups.get(provinceCode) || [];
    provinceFeatures.push(feature);
    groups.set(provinceCode, provinceFeatures);
  }

  return groups;
}

function getSortedProvinceCodes(provinceCodes) {
  return [...provinceCodes].sort((left, right) => {
    const leftIndex = PROVINCE_ORDER.indexOf(left);
    const rightIndex = PROVINCE_ORDER.indexOf(right);

    if (leftIndex !== -1 && rightIndex !== -1) return leftIndex - rightIndex;
    if (leftIndex !== -1) return -1;
    if (rightIndex !== -1) return 1;
    return left.localeCompare(right);
  });
}

function makeFeatureCollection(features, metadata) {
  return {
    type: "FeatureCollection",
    metadata,
    features,
  };
}

async function readExistingManifest() {
  const manifestPath = path.join(RIDING_DATA_DIR, "manifest.json");

  if (!(await pathExists(manifestPath))) {
    return {
      version: 1,
      boundarySets: {},
    };
  }

  return readJson(manifestPath);
}

async function writeManifest(manifest) {
  await fs.mkdir(RIDING_DATA_DIR, { recursive: true });
  await fs.writeFile(
    path.join(RIDING_DATA_DIR, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

async function writeBoundarySetFiles({ source, mode, features, shapeUrl }) {
  const provinceGroups = groupFeaturesByProvince(features);
  const provinceCodes = getSortedProvinceCodes(provinceGroups.keys());
  const boundarySetDir = path.join(RIDING_DATA_DIR, source.code);
  const provinces = {};

  await fs.mkdir(boundarySetDir, { recursive: true });

  for (const provinceCode of provinceCodes) {
    const provinceFeatures = provinceGroups.get(provinceCode);
    const province = PROVINCES_BY_FED_PREFIX[
      provinceFeatures[0].properties.code.slice(0, 2)
    ];
    const fileName = `${provinceCode}.json`;
    const publicPath = `/data/ridings/${source.code}/${fileName}`;
    const featureCollection = makeFeatureCollection(provinceFeatures, {
      boundarySet: source.code,
      provinceCode,
      provinceName: province.name,
      source: "OpenNorth Represent API",
      sourceUrl: shapeUrl,
      geometryMode: mode,
      generatedAt: new Date().toISOString(),
    });

    await fs.writeFile(
      path.join(boundarySetDir, fileName),
      `${JSON.stringify(featureCollection)}\n`,
    );

    provinces[provinceCode] = {
      name: province.name,
      file: fileName,
      publicPath,
      featureCount: provinceFeatures.length,
    };
  }

  return {
    label: source.label,
    shortLabel: source.shortLabel,
    validFromYear: source.validFromYear,
    validToYear: source.validToYear,
    expectedCount: source.expectedCount,
    featureCount: features.length,
    geometryMode: mode,
    source: "OpenNorth Represent API",
    sourceUrl: shapeUrl,
    generatedAt: new Date().toISOString(),
    provinces,
  };
}

function buildPopulationHistory(feature, source) {
  const population = Number(feature.properties.population || 0);

  if (!population) return [];

  return [
    {
      year: source.censusYear,
      population,
    },
  ];
}

function makeRegion(feature, source) {
  const properties = feature.properties;
  const publicPath = `/data/ridings/${source.code}/${properties.provinceCode}.json`;

  return {
    level: "riding",
    code: properties.code,
    name: properties.name,
    provinceCode: properties.provinceCode,
    provinceName: properties.provinceName,
    boundarySet: source.code,
    geometryRef: `${publicPath}#${properties.code}`,
    populationHistory: buildPopulationHistory(feature, source),
  };
}

async function upsertBoundarySets(sources) {
  const operations = sources.map((source) => ({
    updateOne: {
      filter: { code: source.code },
      update: {
        $set: {
          code: source.code,
          name: source.name,
          level: "riding",
          validFromYear: source.validFromYear,
          validToYear: source.validToYear,
          source: "OpenNorth Represent API",
          notes: source.notes,
          active: true,
        },
      },
      upsert: true,
    },
  }));

  if (!operations.length) return { modifiedCount: 0, upsertedCount: 0 };

  return BoundarySet.bulkWrite(operations, { ordered: false });
}

async function upsertRidingRegions(results) {
  const operations = results.flatMap(({ source, features }) =>
    features.map((feature) => {
      const region = makeRegion(feature, source);

      return {
        updateOne: {
          filter: {
            level: "riding",
            code: region.code,
            boundarySet: region.boundarySet,
          },
          update: {
            $set: region,
            $unset: { centroid: "" },
          },
          upsert: true,
        },
      };
    }),
  );

  if (!operations.length) return { modifiedCount: 0, upsertedCount: 0 };

  return Region.bulkWrite(operations, { ordered: false });
}

async function processSource(source, options) {
  const metadataUrl = buildMetadataUrl(source);
  const shapeUrl = buildShapeUrl(source, options.mode);
  const sourceFiles = getSourceFilePaths(source, options.mode);

  await downloadWithCurl(metadataUrl, sourceFiles.metadata, options.skipDownload);
  await downloadWithCurl(shapeUrl, sourceFiles.shape, options.skipDownload);

  const metadataPayload = await readJson(sourceFiles.metadata);
  const shapePayload = await readJson(sourceFiles.shape);
  const metadataObjects = getObjects(metadataPayload, `${source.code} metadata`);
  const shapeObjects = getObjects(shapePayload, `${source.code} shape`);

  validateCount(
    metadataObjects.length,
    source.expectedCount,
    `${source.code} metadata`,
    options.allowCountMismatch,
  );
  validateCount(
    shapeObjects.length,
    source.expectedCount,
    `${source.code} geometry`,
    options.allowCountMismatch,
  );

  const metadataLookup = buildMetadataLookup(metadataObjects);
  const features = shapeObjects.map((shapeObject, shapeIndex) =>
    buildFeature({
      source,
      mode: options.mode,
      metadata: takeMatchingMetadata(
        shapeObject,
        shapeIndex,
        metadataObjects,
        metadataLookup,
      ),
      shapeObject,
      shapeIndex,
    }),
  );

  validateUniqueCodes(features, source.code);

  const manifestEntry = await writeBoundarySetFiles({
    source,
    mode: options.mode,
    features,
    shapeUrl,
  });

  return {
    source,
    features,
    manifestEntry,
  };
}

async function importOpenNorthRidingGeoJson(providedOptions) {
  try {
    const options = providedOptions || parseArgs(process.argv.slice(2));

    if (options.help) {
      printHelp();
      return;
    }

    const sources = getSelectedSources(options.boundarySetCodes);
    const modeConfig = getShapeModeConfig(options.mode);

    console.log(
      `Importing ${modeConfig.description} OpenNorth riding geometry for ${
        sources.map((source) => source.code).join(", ")
      }`,
    );

    const results = [];

    for (const source of sources) {
      results.push(await processSource(source, options));
    }

    const manifest = await readExistingManifest();
    manifest.version = manifest.version || 1;
    manifest.generatedAt = new Date().toISOString();
    manifest.source = "OpenNorth Represent API";
    manifest.boundarySets = manifest.boundarySets || {};

    for (const result of results) {
      manifest.boundarySets[result.source.code] = result.manifestEntry;
    }

    await writeManifest(manifest);

    if (!options.noDb) {
      await connectDB();
      await upsertBoundarySets(sources);
      await upsertRidingRegions(results);
    }

    for (const result of results) {
      const provinceCount = Object.keys(result.manifestEntry.provinces).length;
      console.log(
        `${result.source.code}: wrote ${result.features.length} ridings across ${provinceCount} provinces/territories.`,
      );
    }

    if (options.noDb) {
      console.log("Skipped MongoDB upserts because --no-db was provided.");
    } else {
      console.log("Upserted boundary set and riding region records in MongoDB.");
    }
  } catch (error) {
    console.error("Failed to import OpenNorth riding GeoJSON:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  importOpenNorthRidingGeoJson();
}

module.exports = {
  importOpenNorthRidingGeoJson,
  processSource,
};
