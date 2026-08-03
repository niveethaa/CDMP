const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const connectDB = require("../config/db");
const BoundarySet = require("../models/BoundarySet");

const boundarySets = [
  {
    code: "federal_ridings_1996",
    name: "Federal Ridings - 1996 Representation Order",
    level: "riding",
    validFromYear: 1997,
    validToYear: 2003,
    source: "Statistics Canada 1996 Federal Electoral Districts Digital Cartographic File and PCFRF reference data",
    notes:
      "Boundary set for donation years 1997-2003 using the 1996 Representation Order riding map.",
    active: true,
  },
  {
    code: "federal_ridings_2003",
    name: "Federal Ridings - 2003 Representation Order",
    level: "riding",
    validFromYear: 2004,
    validToYear: 2014,
    source: "Federal electoral district boundary/reference data",
    notes: "CDMP timeline boundary set for donation years 2004-2014.",
    active: true,
  },
  {
    code: "federal_ridings_2013",
    name: "Federal Ridings - 2013 Representation Order",
    level: "riding",
    validFromYear: 2015,
    validToYear: 2024,
    source: "Federal electoral district boundary/reference data",
    notes: "CDMP timeline boundary set for donation years 2015-2024.",
    active: true,
  },
  {
    code: "federal_ridings_2023",
    name: "Federal Ridings - 2023 Representation Orders",
    level: "riding",
    validFromYear: 2025,
    validToYear: null,
    source: "Federal electoral district boundary/reference data",
    notes:
      "Boundary set for donation years 2025 onward. Geometry is not bundled yet, and CDMP currently has no donation data beyond 2024.",
    active: true,
  },
];

const upsertOptions = {
  upsert: true,
  returnDocument: "after",
  setDefaultsOnInsert: true,
};

function getBoundarySetForYear(year) {
  const numericYear = Number(year);

  if (!Number.isInteger(numericYear)) return null;

  return (
    boundarySets.find(
      ({ validFromYear, validToYear }) =>
        numericYear >= validFromYear &&
        (validToYear === null || numericYear <= validToYear),
    ) || null
  );
}

async function seedBoundarySets() {
  try {
    await connectDB();

    for (const boundarySet of boundarySets) {
      await BoundarySet.findOneAndUpdate(
        { code: boundarySet.code },
        { $set: boundarySet },
        upsertOptions,
      );
    }

    console.log(`Seeded ${boundarySets.length} boundary sets.`);
  } catch (error) {
    console.error("Failed to seed boundary sets:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  seedBoundarySets();
}

module.exports = {
  boundarySets,
  getBoundarySetForYear,
  seedBoundarySets,
};
