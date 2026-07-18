const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const connectDB = require("../config/db");
const Donation = require("../models/Donation");
const Region = require("../models/Region");
const RegionStat = require("../models/RegionStat");

const DEFAULT_BEGINNING_YEAR = 1993;
const DEFAULT_ENDING_YEAR = 2024;

const PARTY_CODE = "ALL";
const METRIC_MODE = "total";
const SUPPRESSION_THRESHOLD = 5;
const BULK_WRITE_SIZE = 1000;

const VALID_LEVELS = new Set(["national", "province", "riding"]);

const AMOUNT_EXPRESSION = { $ifNull: ["$contribution.amountTotal", 0] };

const DONOR_KEY_EXPRESSION = {
  $concat: [
    { $ifNull: ["$donor.donorDisplayName", ""] },
    "|",
    { $ifNull: ["$donor.postalCode", ""] },
  ],
};

const PARTY_CODE_EXPRESSION = { $ifNull: ["$party.code", "UNKNOWN"] };
const PARTY_NAME_EXPRESSION = { $ifNull: ["$party.name", "Unknown Party"] };

const PROVINCE_CODE_EXPRESSION = {
  $toUpper: { $ifNull: ["$geography.provinceCode", ""] },
};

const NATIONAL_GROUP_ID = {
  year: "$source.year",
};

const PROVINCE_GROUP_ID = {
  year: "$source.year",
  provinceCode: PROVINCE_CODE_EXPRESSION,
};

const RIDING_GROUP_ID = {
  year: "$source.year",
  boundarySet: "$geography.boundarySet",
  ridingCode: "$geography.ridingCode",
};

const NON_EMPTY_PROVINCE_STAGES = [
  {
    $match: {
      "_id.provinceCode": { $ne: "" },
    },
  },
];

function getArgValue(flagName) {
  const index = process.argv.indexOf(flagName);
  return index === -1 ? null : process.argv[index + 1] || null;
}

function getNumberArg(flagName) {
  const parsed = Number(getArgValue(flagName));
  return Number.isInteger(parsed) ? parsed : null;
}

function getLevelsToBuild() {
  const levelArg = getArgValue("--level");

  if (!levelArg || levelArg === "all") {
    return [...VALID_LEVELS];
  }

  const levels = levelArg
    .split(",")
    .map((level) => level.trim())
    .filter(Boolean);

  const invalidLevel = levels.find((level) => !VALID_LEVELS.has(level));

  if (invalidLevel) {
    throw new Error(
      `Invalid level "${invalidLevel}". Use national, province, riding, or all.`,
    );
  }

  return levels;
}

function getYearsToBuild() {
  const year = getNumberArg("--year");

  if (year) return [year];

  const beginningYear =
    getNumberArg("--beginning-year") || DEFAULT_BEGINNING_YEAR;
  const endingYear = getNumberArg("--ending-year") || DEFAULT_ENDING_YEAR;

  if (beginningYear > endingYear) {
    throw new Error("beginning-year cannot be greater than ending-year.");
  }

  return Array.from(
    { length: endingYear - beginningYear + 1 },
    (_, index) => beginningYear + index,
  );
}

function buildBaseMatch(years) {
  return {
    "source.year": { $in: years },
    "access.publicAggregationAllowed": { $ne: false },
  };
}

function buildRidingMatch(years) {
  return {
    ...buildBaseMatch(years),
    "geography.geoCodeStatus": "matched",
    "geography.ridingCode": { $ne: "" },
    "geography.boundarySet": { $ne: "" },
  };
}

function roundAmount(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function calculateAverage(totalDonations, donationCount) {
  return donationCount ? roundAmount(totalDonations / donationCount) : 0;
}

function buildEmptyTotals() {
  return {
    totalDonations: 0,
    donationCount: 0,
    donorCount: 0,
    averageDonation: 0,
    perCapitaAmount: 0,
    population: 0,
  };
}

function buildPrivacy(donorCount) {
  const isSuppressed = donorCount < SUPPRESSION_THRESHOLD;

  let suppressionReason = "";

  if (donorCount === 0) {
    suppressionReason = "No donation data available for this region.";
  } else if (isSuppressed) {
    suppressionReason = `Donor count is below suppression threshold of ${SUPPRESSION_THRESHOLD}.`;
  }

  return {
    isSuppressed,
    suppressionThreshold: SUPPRESSION_THRESHOLD,
    suppressionReason,
    computedAt: new Date(),
  };
}

function buildTrendPoint(year, totals) {
  return {
    year,
    totalDonations: roundAmount(totals.totalDonations),
    donationCount: totals.donationCount || 0,
    donorCount: totals.donorCount || 0,
    perCapitaAmount: totals.perCapitaAmount || 0,
  };
}

function normalizeTotals(totals) {
  const totalDonations = roundAmount(totals?.totalDonations || 0);
  const donationCount = totals?.donationCount || 0;
  const donorCount = totals?.donorCount || 0;

  return {
    totalDonations,
    donationCount,
    donorCount,
    averageDonation: calculateAverage(totalDonations, donationCount),
    perCapitaAmount: totals?.perCapitaAmount || 0,
    population: totals?.population || 0,
  };
}

function createRegionStat(region, year, totals, partyStats = []) {
  const normalizedTotals = normalizeTotals(totals);

  return {
    region: {
      level: region.level,
      code: region.code,
      name: region.name,
      provinceCode: region.provinceCode || "",
      boundarySet: region.boundarySet || "",
    },

    filters: {
      beginningYear: year,
      endingYear: year,
      partyCode: PARTY_CODE,
      metricMode: METRIC_MODE,
    },

    totals: normalizedTotals,
    partyStats,
    donationsTrend: [buildTrendPoint(year, normalizedTotals)],
    privacy: buildPrivacy(normalizedTotals.donorCount),
  };
}

function buildRegionStatUpsertFilter(regionStat) {
  return {
    "region.level": regionStat.region.level,
    "region.code": regionStat.region.code,
    "region.boundarySet": regionStat.region.boundarySet,
    "filters.beginningYear": regionStat.filters.beginningYear,
    "filters.endingYear": regionStat.filters.endingYear,
    "filters.partyCode": regionStat.filters.partyCode,
    "filters.metricMode": regionStat.filters.metricMode,
  };
}

function buildRegionStatBulkOperation(regionStat) {
  return {
    updateOne: {
      filter: buildRegionStatUpsertFilter(regionStat),
      update: { $set: regionStat },
      upsert: true,
    },
  };
}

async function flushRegionStatOperations(operations) {
  if (!operations.length) return;

  await RegionStat.bulkWrite(operations, { ordered: false });
  operations.length = 0;
}

async function saveRegionStats(regionStats) {
  const operations = [];
  let count = 0;

  for (const regionStat of regionStats) {
    operations.push(buildRegionStatBulkOperation(regionStat));
    count += 1;

    if (operations.length >= BULK_WRITE_SIZE) {
      await flushRegionStatOperations(operations);
    }
  }

  await flushRegionStatOperations(operations);
  return count;
}

function addToListMap(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function makeProvinceKey(year, provinceCode) {
  return `${year}|${provinceCode}`;
}

function makeRidingKey(year, boundarySet, ridingCode) {
  return `${year}|${boundarySet}|${ridingCode}`;
}

function makeRidingRegionKey(boundarySet, ridingCode) {
  return `${boundarySet}|${ridingCode}`;
}

function makePartyKey(...parts) {
  return parts.join("|");
}

async function loadRegions() {
  const nationalRegion = await Region.findOne({
    level: "national",
    code: "CA",
  }).lean();

  if (!nationalRegion) {
    throw new Error(
      "National region CA not found. Run npm run seed:regions first.",
    );
  }

  const provinceRegions = await Region.find({ level: "province" })
    .sort({ code: 1 })
    .lean();

  const ridingRegions = await Region.find({ level: "riding" })
    .sort({ boundarySet: 1, code: 1 })
    .lean();

  const ridingRegionMap = new Map(
    ridingRegions.map((region) => [
      makeRidingRegionKey(region.boundarySet, region.code),
      region,
    ]),
  );

  return {
    nationalRegion,
    provinceRegions,
    ridingRegionMap,
  };
}

async function aggregateTotalsByGroup({
  match,
  groupId,
  donorGroupId,
  makeKey,
  extraTotals = () => ({}),
  postTotalGroupStages = [],
  postDonorGroupStages = [],
}) {
  const [totals, donorCounts] = await Promise.all([
    Donation.aggregate([
      { $match: match },
      {
        $group: {
          _id: groupId,
          totalDonations: { $sum: AMOUNT_EXPRESSION },
          donationCount: { $sum: 1 },
        },
      },
      ...postTotalGroupStages,
    ]).allowDiskUse(true),

    Donation.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            ...groupId,
            donorKey: DONOR_KEY_EXPRESSION,
          },
        },
      },
      ...postDonorGroupStages,
      {
        $group: {
          _id: donorGroupId,
          donorCount: { $sum: 1 },
        },
      },
    ]).allowDiskUse(true),
  ]);

  const donorCountMap = new Map(
    donorCounts.map((item) => [makeKey(item._id), item.donorCount]),
  );

  const totalsMap = new Map();

  for (const item of totals) {
    const key = makeKey(item._id);
    const totalDonations = roundAmount(item.totalDonations);
    const donationCount = item.donationCount || 0;

    totalsMap.set(key, {
      ...extraTotals(item._id),
      totalDonations,
      donationCount,
      donorCount: donorCountMap.get(key) || 0,
      averageDonation: calculateAverage(totalDonations, donationCount),
      perCapitaAmount: 0,
      population: 0,
    });
  }

  return totalsMap;
}

async function aggregatePartyStatsByGroup({
  match,
  groupId,
  donorGroupId,
  makeStatsKey,
  makeDonorKey,
  postTotalGroupStages = [],
  postDonorGroupStages = [],
}) {
  const partyGroupId = {
    ...groupId,
    partyCode: PARTY_CODE_EXPRESSION,
    partyName: PARTY_NAME_EXPRESSION,
  };

  const [totals, donorCounts] = await Promise.all([
    Donation.aggregate([
      { $match: match },
      {
        $group: {
          _id: partyGroupId,
          totalDonations: { $sum: AMOUNT_EXPRESSION },
          donationCount: { $sum: 1 },
        },
      },
      ...postTotalGroupStages,
    ]).allowDiskUse(true),

    Donation.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            ...partyGroupId,
            donorKey: DONOR_KEY_EXPRESSION,
          },
        },
      },
      ...postDonorGroupStages,
      {
        $group: {
          _id: donorGroupId,
          donorCount: { $sum: 1 },
        },
      },
    ]).allowDiskUse(true),
  ]);

  const donorCountMap = new Map(
    donorCounts.map((item) => [makeDonorKey(item._id), item.donorCount]),
  );

  const partyStatsMap = new Map();

  for (const item of totals) {
    const id = item._id;

    addToListMap(partyStatsMap, makeStatsKey(id), {
      partyCode: id.partyCode,
      partyName: id.partyName,
      totalDonations: roundAmount(item.totalDonations),
      donationCount: item.donationCount,
      donorCount: donorCountMap.get(makeDonorKey(id)) || 0,
    });
  }

  for (const partyStats of partyStatsMap.values()) {
    partyStats.sort((a, b) => b.totalDonations - a.totalDonations);
  }

  return partyStatsMap;
}

async function aggregateNationalTotals(years) {
  return aggregateTotalsByGroup({
    match: buildBaseMatch(years),
    groupId: NATIONAL_GROUP_ID,
    donorGroupId: { year: "$_id.year" },
    makeKey: ({ year }) => year,
  });
}

async function aggregateNationalPartyStats(years) {
  return aggregatePartyStatsByGroup({
    match: buildBaseMatch(years),
    groupId: NATIONAL_GROUP_ID,
    donorGroupId: {
      year: "$_id.year",
      partyCode: "$_id.partyCode",
      partyName: "$_id.partyName",
    },
    makeStatsKey: ({ year }) => year,
    makeDonorKey: ({ year, partyCode }) => makePartyKey(year, partyCode),
  });
}

async function aggregateProvinceTotals(years) {
  return aggregateTotalsByGroup({
    match: buildBaseMatch(years),
    groupId: PROVINCE_GROUP_ID,
    donorGroupId: {
      year: "$_id.year",
      provinceCode: "$_id.provinceCode",
    },
    postTotalGroupStages: NON_EMPTY_PROVINCE_STAGES,
    postDonorGroupStages: NON_EMPTY_PROVINCE_STAGES,
    makeKey: ({ year, provinceCode }) => makeProvinceKey(year, provinceCode),
  });
}

async function aggregateProvincePartyStats(years) {
  return aggregatePartyStatsByGroup({
    match: buildBaseMatch(years),
    groupId: PROVINCE_GROUP_ID,
    donorGroupId: {
      year: "$_id.year",
      provinceCode: "$_id.provinceCode",
      partyCode: "$_id.partyCode",
      partyName: "$_id.partyName",
    },
    postTotalGroupStages: NON_EMPTY_PROVINCE_STAGES,
    postDonorGroupStages: NON_EMPTY_PROVINCE_STAGES,
    makeStatsKey: ({ year, provinceCode }) =>
      makeProvinceKey(year, provinceCode),
    makeDonorKey: ({ year, provinceCode, partyCode }) =>
      makePartyKey(year, provinceCode, partyCode),
  });
}

async function aggregateRidingTotals(years) {
  return aggregateTotalsByGroup({
    match: buildRidingMatch(years),
    groupId: RIDING_GROUP_ID,
    donorGroupId: {
      year: "$_id.year",
      boundarySet: "$_id.boundarySet",
      ridingCode: "$_id.ridingCode",
    },
    makeKey: ({ year, boundarySet, ridingCode }) =>
      makeRidingKey(year, boundarySet, ridingCode),
    extraTotals: ({ year, boundarySet, ridingCode }) => ({
      year,
      boundarySet,
      ridingCode,
    }),
  });
}

async function aggregateRidingPartyStats(years) {
  return aggregatePartyStatsByGroup({
    match: buildRidingMatch(years),
    groupId: RIDING_GROUP_ID,
    donorGroupId: {
      year: "$_id.year",
      boundarySet: "$_id.boundarySet",
      ridingCode: "$_id.ridingCode",
      partyCode: "$_id.partyCode",
      partyName: "$_id.partyName",
    },
    makeStatsKey: ({ year, boundarySet, ridingCode }) =>
      makeRidingKey(year, boundarySet, ridingCode),
    makeDonorKey: ({ year, boundarySet, ridingCode, partyCode }) =>
      makePartyKey(year, boundarySet, ridingCode, partyCode),
  });
}

async function buildNationalStats(years, nationalRegion) {
  console.log("Building annual national RegionStats...");

  const totalsMap = await aggregateNationalTotals(years);
  const partyStatsMap = await aggregateNationalPartyStats(years);

  const regionStats = years.map((year) =>
    createRegionStat(
      nationalRegion,
      year,
      totalsMap.get(year) || buildEmptyTotals(),
      partyStatsMap.get(year) || [],
    ),
  );

  const count = await saveRegionStats(regionStats);

  console.log(`Saved ${count} annual national RegionStats.`);
  return count;
}

async function buildProvinceStats(years, provinceRegions) {
  console.log("Building annual province RegionStats...");

  const totalsMap = await aggregateProvinceTotals(years);
  const partyStatsMap = await aggregateProvincePartyStats(years);

  const regionStats = [];

  for (const year of years) {
    for (const region of provinceRegions) {
      const key = makeProvinceKey(year, region.code);

      regionStats.push(
        createRegionStat(
          region,
          year,
          totalsMap.get(key) || buildEmptyTotals(),
          partyStatsMap.get(key) || [],
        ),
      );
    }
  }

  const count = await saveRegionStats(regionStats);

  console.log(`Saved ${count} annual province RegionStats.`);
  return count;
}

async function buildRidingStats(years, ridingRegionMap) {
  console.log("Building annual riding RegionStats...");

  const totalsMap = await aggregateRidingTotals(years);
  const partyStatsMap = await aggregateRidingPartyStats(years);

  const regionStats = [];
  let skippedNoRegion = 0;

  for (const [key, totals] of totalsMap.entries()) {
    const regionKey = makeRidingRegionKey(
      totals.boundarySet,
      totals.ridingCode,
    );
    const region = ridingRegionMap.get(regionKey);

    if (!region) {
      skippedNoRegion += 1;
      continue;
    }

    regionStats.push(
      createRegionStat(
        region,
        totals.year,
        totals,
        partyStatsMap.get(key) || [],
      ),
    );
  }

  const count = await saveRegionStats(regionStats);

  console.log(`Saved ${count} annual riding RegionStats.`);

  if (skippedNoRegion > 0) {
    console.log(
      `Skipped ${skippedNoRegion} riding stats with no Region record.`,
    );
  }

  return count;
}

async function buildTimelineRegionStats() {
  try {
    await connectDB();

    const years = getYearsToBuild();
    const levels = getLevelsToBuild();

    console.log("Building timeline-ready RegionStats...");
    console.log(`Years: ${years[0]}-${years[years.length - 1]}`);
    console.log(`Levels: ${levels.join(", ")}`);

    const donationCount = await Donation.countDocuments(buildBaseMatch(years));

    if (donationCount === 0) {
      throw new Error("No matching Donation records found.");
    }

    console.log(
      `Donation records available for timeline aggregation: ${donationCount}`,
    );

    const { nationalRegion, provinceRegions, ridingRegionMap } =
      await loadRegions();

    const summary = {
      national: 0,
      province: 0,
      riding: 0,
    };

    if (levels.includes("national")) {
      summary.national = await buildNationalStats(years, nationalRegion);
    }

    if (levels.includes("province")) {
      summary.province = await buildProvinceStats(years, provinceRegions);
    }

    if (levels.includes("riding")) {
      summary.riding = await buildRidingStats(years, ridingRegionMap);
    }

    console.log("\nTimeline RegionStat build complete.");
    console.log(`National records saved: ${summary.national}`);
    console.log(`Province records saved: ${summary.province}`);
    console.log(`Riding records saved: ${summary.riding}`);
  } catch (error) {
    console.error("Failed to build timeline RegionStats:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  buildTimelineRegionStats();
}

module.exports = {
  calculateAverage,
  buildPrivacy,
  buildTrendPoint,
  createRegionStat,
  buildRegionStatUpsertFilter,
  makeProvinceKey,
  makeRidingKey,
  buildTimelineRegionStats,
};
