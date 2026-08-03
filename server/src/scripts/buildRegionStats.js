const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

const connectDB = require("../config/db");
const Donation = require("../models/Donation");
const Region = require("../models/Region");
const RegionStat = require("../models/RegionStat");

const BEGINNING_YEAR = 1993;
const ENDING_YEAR = 2024;
const PARTY_CODE = "ALL";
const METRIC_MODE = "total";
const SUPPRESSION_THRESHOLD = 5;

const BASE_MATCH = {
  "source.year": {
    $gte: BEGINNING_YEAR,
    $lte: ENDING_YEAR,
  },
  "access.publicAggregationAllowed": {
    $ne: false,
  },
};

const AMOUNT_EXPRESSION = {
  $ifNull: ["$contribution.amountTotal", 0],
};

const PROVINCE_CODE_EXPRESSION = {
  $toUpper: {
    $ifNull: ["$geography.provinceCode", ""],
  },
};

const DONOR_KEY_EXPRESSION = {
  $concat: [
    { $ifNull: ["$donor.donorDisplayName", ""] },
    "|",
    { $ifNull: ["$donor.postalCode", ""] },
  ],
};

const PARTY_FIELDS = {
  partyCode: {
    $ifNull: ["$party.code", "UNKNOWN"],
  },
  partyName: {
    $ifNull: ["$party.name", "Unknown Party"],
  },
};

const PROVINCE_FIELDS = {
  provinceCode: PROVINCE_CODE_EXPRESSION,
};

const YEAR_FIELDS = {
  year: "$source.year",
};

const PROVINCE_PARTY_FIELDS = {
  provinceCode: PROVINCE_CODE_EXPRESSION,
  partyCode: PARTY_FIELDS.partyCode,
  partyName: PARTY_FIELDS.partyName,
};

const PROVINCE_YEAR_FIELDS = {
  provinceCode: PROVINCE_CODE_EXPRESSION,
  year: "$source.year",
};

function roundAmount(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function calculateAverage(totalDonations, donationCount) {
  if (!donationCount) {
    return 0;
  }

  return roundAmount(totalDonations / donationCount);
}

function buildTotals(totalDonations, donationCount, donorCount) {
  const roundedTotal = roundAmount(totalDonations);
  const count = donationCount || 0;

  return {
    totalDonations: roundedTotal,
    donationCount: count,
    donorCount: donorCount || 0,
    averageDonation: calculateAverage(roundedTotal, count),
    perCapitaAmount: 0,
    population: 0,
  };
}

function buildEmptyTotals() {
  return buildTotals(0, 0, 0);
}

function buildPrivacy(donorCount) {
  const isSuppressed = donorCount < SUPPRESSION_THRESHOLD;
  let suppressionReason = "";

  if (donorCount === 0) {
    suppressionReason = "No donation data available for this region.";
  } else if (isSuppressed) {
    suppressionReason =
      "Donor count is below suppression threshold of " +
      SUPPRESSION_THRESHOLD +
      ".";
  }

  return {
    isSuppressed,
    suppressionThreshold: SUPPRESSION_THRESHOLD,
    suppressionReason,
    computedAt: new Date(),
  };
}

function createRegionStat(region, totals, partyStats, donationsTrend) {
  const normalizedTotals = buildTotals(
    totals.totalDonations,
    totals.donationCount,
    totals.donorCount,
  );

  return {
    region: {
      level: region.level,
      code: region.code,
      name: region.name,
      provinceCode: region.provinceCode || "",
      boundarySet: region.boundarySet || "",
    },

    filters: {
      beginningYear: BEGINNING_YEAR,
      endingYear: ENDING_YEAR,
      partyCode: PARTY_CODE,
      metricMode: METRIC_MODE,
    },

    totals: normalizedTotals,

    partyStats: partyStats || [],

    donationsTrend: donationsTrend || [],

    privacy: buildPrivacy(normalizedTotals.donorCount),
  };
}

function runDonationAggregation(pipeline) {
  return Donation.aggregate(pipeline).allowDiskUse(true);
}

function getGroupId(fields) {
  const fieldNames = Object.keys(fields);

  if (fieldNames.length === 0) {
    return null;
  }

  return fields;
}

function getSecondGroupId(fieldNames) {
  const groupId = {};

  for (const fieldName of fieldNames) {
    groupId[fieldName] = "$_id." + fieldName;
  }

  return groupId;
}

function makeMapKey(id, fieldNames) {
  const values = [];

  for (const fieldName of fieldNames) {
    values.push(String(id[fieldName]));
  }

  return values.join("|");
}

function makeDonorCountMap(donorCounts, keyFields) {
  const map = new Map();

  for (const item of donorCounts) {
    const key = makeMapKey(item._id, keyFields);
    map.set(key, item.donorCount);
  }

  return map;
}

function getDonorCount(donorCountMap, id, keyFields) {
  const key = makeMapKey(id, keyFields);
  return donorCountMap.get(key) || 0;
}

async function aggregateTotals(fields) {
  return runDonationAggregation([
    {
      $match: BASE_MATCH,
    },
    {
      $group: {
        _id: getGroupId(fields),
        totalDonations: {
          $sum: AMOUNT_EXPRESSION,
        },
        donationCount: {
          $sum: 1,
        },
      },
    },
  ]);
}

async function aggregateDonorCounts(fields) {
  const fieldNames = Object.keys(fields);

  if (fieldNames.length === 0) {
    return runDonationAggregation([
      {
        $match: BASE_MATCH,
      },
      {
        $group: {
          _id: DONOR_KEY_EXPRESSION,
        },
      },
      {
        $count: "donorCount",
      },
    ]);
  }

  return runDonationAggregation([
    {
      $match: BASE_MATCH,
    },
    {
      $group: {
        _id: {
          ...fields,
          donorKey: DONOR_KEY_EXPRESSION,
        },
      },
    },
    {
      $group: {
        _id: getSecondGroupId(fieldNames),
        donorCount: {
          $sum: 1,
        },
      },
    },
  ]);
}

async function aggregateNationalTotals() {
  const [totalResult] = await aggregateTotals({});
  const [donorResult] = await aggregateDonorCounts({});

  return buildTotals(
    totalResult?.totalDonations || 0,
    totalResult?.donationCount || 0,
    donorResult?.donorCount || 0,
  );
}

async function aggregateNationalPartyStats() {
  const totals = await aggregateTotals(PARTY_FIELDS);
  const donorCounts = await aggregateDonorCounts(PARTY_FIELDS);

  const donorCountMap = makeDonorCountMap(donorCounts, ["partyCode"]);

  totals.sort((a, b) => b.totalDonations - a.totalDonations);

  return totals.map((item) => {
    return {
      partyCode: item._id.partyCode,
      partyName: item._id.partyName,
      totalDonations: roundAmount(item.totalDonations),
      donationCount: item.donationCount,
      donorCount: getDonorCount(donorCountMap, item._id, ["partyCode"]),
    };
  });
}

async function aggregateNationalTrend() {
  const totals = await aggregateTotals(YEAR_FIELDS);
  const donorCounts = await aggregateDonorCounts(YEAR_FIELDS);

  const donorCountMap = makeDonorCountMap(donorCounts, ["year"]);

  totals.sort((a, b) => a._id.year - b._id.year);

  return totals.map((item) => {
    return {
      year: item._id.year,
      totalDonations: roundAmount(item.totalDonations),
      donationCount: item.donationCount,
      donorCount: getDonorCount(donorCountMap, item._id, ["year"]),
      perCapitaAmount: 0,
    };
  });
}

async function aggregateProvinceTotalsMap() {
  const totals = await aggregateTotals(PROVINCE_FIELDS);
  const donorCounts = await aggregateDonorCounts(PROVINCE_FIELDS);

  const donorCountMap = makeDonorCountMap(donorCounts, ["provinceCode"]);
  const totalsMap = new Map();

  for (const item of totals) {
    const provinceCode = item._id.provinceCode;

    const totalsForProvince = buildTotals(
      item.totalDonations,
      item.donationCount,
      getDonorCount(donorCountMap, item._id, ["provinceCode"]),
    );

    totalsMap.set(provinceCode, totalsForProvince);
  }

  return totalsMap;
}

async function aggregateProvincePartyStatsMap() {
  const totals = await aggregateTotals(PROVINCE_PARTY_FIELDS);
  const donorCounts = await aggregateDonorCounts(PROVINCE_PARTY_FIELDS);

  const donorCountMap = makeDonorCountMap(donorCounts, [
    "provinceCode",
    "partyCode",
  ]);

  const partyStatsMap = new Map();

  for (const item of totals) {
    const provinceCode = item._id.provinceCode;
    const partyCode = item._id.partyCode;

    if (!partyStatsMap.has(provinceCode)) {
      partyStatsMap.set(provinceCode, []);
    }

    partyStatsMap.get(provinceCode).push({
      partyCode,
      partyName: item._id.partyName,
      totalDonations: roundAmount(item.totalDonations),
      donationCount: item.donationCount,
      donorCount: getDonorCount(donorCountMap, item._id, [
        "provinceCode",
        "partyCode",
      ]),
    });
  }

  for (const partyStats of partyStatsMap.values()) {
    partyStats.sort((a, b) => b.totalDonations - a.totalDonations);
  }

  return partyStatsMap;
}

async function aggregateProvinceTrendMap() {
  const totals = await aggregateTotals(PROVINCE_YEAR_FIELDS);
  const donorCounts = await aggregateDonorCounts(PROVINCE_YEAR_FIELDS);

  const donorCountMap = makeDonorCountMap(donorCounts, [
    "provinceCode",
    "year",
  ]);

  const trendMap = new Map();

  for (const item of totals) {
    const provinceCode = item._id.provinceCode;
    const year = item._id.year;

    if (!trendMap.has(provinceCode)) {
      trendMap.set(provinceCode, []);
    }

    trendMap.get(provinceCode).push({
      year,
      totalDonations: roundAmount(item.totalDonations),
      donationCount: item.donationCount,
      donorCount: getDonorCount(donorCountMap, item._id, [
        "provinceCode",
        "year",
      ]),
      perCapitaAmount: 0,
    });
  }

  for (const trend of trendMap.values()) {
    trend.sort((a, b) => a.year - b.year);
  }

  return trendMap;
}

async function upsertRegionStat(regionStat) {
  return RegionStat.findOneAndUpdate(
    {
      "region.level": regionStat.region.level,
      "region.code": regionStat.region.code,
      "filters.beginningYear": BEGINNING_YEAR,
      "filters.endingYear": ENDING_YEAR,
      "filters.partyCode": PARTY_CODE,
      "filters.metricMode": METRIC_MODE,
    },
    {
      $set: regionStat,
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
    },
  );
}

async function buildNationalRegionStat() {
  const nationalRegion = await Region.findOne({
    level: "national",
    code: "CA",
  }).lean();

  if (!nationalRegion) {
    throw new Error(
      "National region CA not found. Run npm run seed:regions first.",
    );
  }

  console.log("Building national RegionStat...");

  const totals = await aggregateNationalTotals();
  const partyStats = await aggregateNationalPartyStats();
  const donationsTrend = await aggregateNationalTrend();

  const regionStat = createRegionStat(
    nationalRegion,
    totals,
    partyStats,
    donationsTrend,
  );

  await upsertRegionStat(regionStat);

  console.log("Saved national RegionStat for Canada.");
}

async function buildProvinceRegionStats() {
  const provinceRegions = await Region.find({
    level: "province",
  })
    .sort({ code: 1 })
    .lean();

  if (provinceRegions.length === 0) {
    throw new Error(
      "Province regions not found. Run npm run seed:regions first.",
    );
  }

  console.log("Building province RegionStats...");

  const totalsMap = await aggregateProvinceTotalsMap();
  const partyStatsMap = await aggregateProvincePartyStatsMap();
  const trendMap = await aggregateProvinceTrendMap();

  let savedCount = 0;

  for (const region of provinceRegions) {
    const totals = totalsMap.get(region.code) || buildEmptyTotals();
    const partyStats = partyStatsMap.get(region.code) || [];
    const donationsTrend = trendMap.get(region.code) || [];

    const regionStat = createRegionStat(
      region,
      totals,
      partyStats,
      donationsTrend,
    );

    await upsertRegionStat(regionStat);

    savedCount += 1;

    console.log(
      "Saved province RegionStat for " +
        region.code +
        " - " +
        region.name +
        ".",
    );
  }

  console.log("Saved " + savedCount + " province RegionStat records.");
}

async function buildRegionStats() {
  try {
    await connectDB();

    const donationCount = await Donation.countDocuments(BASE_MATCH);

    if (donationCount === 0) {
      throw new Error(
        "No Donation records found for 1993-2024. Import donations first.",
      );
    }

    console.log("Donation records available for aggregation: " + donationCount);

    await buildNationalRegionStat();
    await buildProvinceRegionStats();

    const regionStatCount = await RegionStat.countDocuments({
      "filters.beginningYear": BEGINNING_YEAR,
      "filters.endingYear": ENDING_YEAR,
      "filters.partyCode": PARTY_CODE,
      "filters.metricMode": METRIC_MODE,
    });

    console.log("\nRegionStat build complete.");
    console.log(
      "RegionStat records for " +
        BEGINNING_YEAR +
        "-" +
        ENDING_YEAR +
        ": " +
        regionStatCount,
    );
  } catch (error) {
    console.error("Failed to build RegionStats:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  buildRegionStats();
}

module.exports = {
  buildRegionStats,
  createRegionStat,
  calculateAverage,
  buildPrivacy,
};
