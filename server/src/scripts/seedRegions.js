const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

const connectDB = require("../config/db");
const Region = require("../models/Region");

function makeProvince(code, name) {
  return {
    level: "province",
    code: code,
    name: name,
    provinceCode: code,
    provinceName: name,
    boundarySet: "province_2024",
    geometryRef: "",
    populationHistory: [],
  };
}

const regions = [
  {
    level: "national",
    code: "CA",
    name: "Canada",
    provinceCode: "",
    provinceName: "",
    boundarySet: "national_2024",
    geometryRef: "",
    populationHistory: [],
  },

  makeProvince("AB", "Alberta"),
  makeProvince("BC", "British Columbia"),
  makeProvince("MB", "Manitoba"),
  makeProvince("NB", "New Brunswick"),
  makeProvince("NL", "Newfoundland and Labrador"),
  makeProvince("NS", "Nova Scotia"),
  makeProvince("NT", "Northwest Territories"),
  makeProvince("NU", "Nunavut"),
  makeProvince("ON", "Ontario"),
  makeProvince("PE", "Prince Edward Island"),
  makeProvince("QC", "Quebec"),
  makeProvince("SK", "Saskatchewan"),
  makeProvince("YT", "Yukon"),
];

async function removeBadCentroids() {
  await Region.collection.updateMany(
    {
      centroid: { $exists: true },
      "centroid.coordinates": { $exists: false },
    },
    {
      $unset: {
        centroid: "",
      },
    },
  );
}

async function seedRegions() {
  try {
    await connectDB();

    await removeBadCentroids();

    for (const region of regions) {
      await Region.updateOne(
        {
          level: region.level,
          code: region.code,
        },
        {
          $set: region,

          // Keep centroid empty unless you have valid coordinates.
          $unset: {
            centroid: "",
          },
        },
        {
          upsert: true,

          // Important: prevents Mongoose from adding the bad default centroid.
          setDefaultsOnInsert: false,
        },
      );
    }

    console.log("Seeded " + regions.length + " regions.");
  } catch (error) {
    console.error("Failed to seed regions:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  seedRegions();
}

module.exports = {
  regions,
  seedRegions,
};
