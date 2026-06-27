const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const connectDB = require("../config/db");
const BoundarySet = require("../models/BoundarySet");

const boundarySets = [
  {
    code: "federal_ridings_2003",
    name: "Federal Ridings - 2003 Representation Order",
    level: "riding",
    validFromYear: 2004,
    validToYear: 2014,
    source: "Federal electoral district boundary/reference data",
    notes: "Initial CDMP timeline boundary set for donation years 2004-2014.",
    active: true,
  },
  {
    code: "federal_ridings_2013",
    name: "Federal Ridings - 2013 Representation Order",
    level: "riding",
    validFromYear: 2015,
    validToYear: 2024,
    source: "Federal electoral district boundary/reference data",
    notes: "Initial CDMP timeline boundary set for donation years 2015-2024.",
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
      "Initial CDMP timeline boundary set for donation years 2025 onward. Year range can be adjusted if the product chooses a different boundary-year policy.",
    active: true,
  },
];

const upsertOptions = {
  upsert: true,
  new: true,
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
