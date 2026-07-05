const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const connectDB = require("../config/db");
const Region = require("../models/Region");

const RIDING_DATA_DIR = path.resolve(
  __dirname,
  "../../../client/public/data/ridings",
);

function buildPopulationHistory(feature) {
  const population = Number(feature.properties?.population || 0);

  if (!population) return [];

  const censusYearByBoundarySet = {
    federal_ridings_1996: 1996,
    federal_ridings_2003: 2006,
    federal_ridings_2013: 2011,
    federal_ridings_2023: 2021,
  };

  return [
    {
      year: censusYearByBoundarySet[feature.properties?.boundarySet] || 0,
      population,
    },
  ].filter((entry) => entry.year);
}

function makeRidingRegion(feature, filePath) {
  const properties = feature.properties || {};
  const code = String(properties.code || properties.fednum || "").padStart(5, "0");

  return {
    level: "riding",
    code,
    name: properties.name,
    provinceCode: properties.provinceCode,
    provinceName: properties.provinceName,
    boundarySet: properties.boundarySet,
    geometryRef: `${filePath}#${code}`,
    populationHistory: buildPopulationHistory(feature),
  };
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function loadRidingRegions() {
  const manifest = await readJson(path.join(RIDING_DATA_DIR, "manifest.json"));
  const regions = [];

  for (const [boundarySetCode, boundarySet] of Object.entries(
    manifest.boundarySets || {},
  )) {
    for (const provinceCode of Object.keys(boundarySet.provinces || {})) {
      const publicPath = `/data/ridings/${boundarySetCode}/${provinceCode}.json`;
      const filePath = path.join(RIDING_DATA_DIR, boundarySetCode, `${provinceCode}.json`);
      const featureCollection = await readJson(filePath);

      for (const feature of featureCollection.features || []) {
        regions.push(makeRidingRegion(feature, publicPath));
      }
    }
  }

  return regions;
}

async function seedRidingRegions() {
  try {
    await connectDB();

    const ridingRegions = await loadRidingRegions();

    for (const region of ridingRegions) {
      await Region.updateOne(
        {
          level: "riding",
          code: region.code,
          boundarySet: region.boundarySet,
        },
        {
          $set: region,
          $unset: { centroid: "" },
        },
        {
          upsert: true,
          setDefaultsOnInsert: false,
        },
      );
    }

    console.log(`Seeded ${ridingRegions.length} riding region records.`);
  } catch (error) {
    console.error("Failed to seed riding regions:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  seedRidingRegions();
}

module.exports = {
  loadRidingRegions,
  seedRidingRegions,
};
