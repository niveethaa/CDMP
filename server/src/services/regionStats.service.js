const RegionStat = require("../models/RegionStat");

const DEFAULT_BEGINNING_YEAR = 1993;
const DEFAULT_ENDING_YEAR = 2024;
const DEFAULT_PARTY_CODE = "ALL";
const DEFAULT_METRIC_MODE = "total";
const SELECT_PUBLIC_STATS = "region totals partyStats donationsTrend privacy filters";

function buildPrivacy(donorCount) {
  const threshold = 5;
  const isSuppressed = donorCount < threshold;

  let suppressionReason = "";
  if (donorCount === 0) {
    suppressionReason = "No donation data available for this region.";
  } else if (isSuppressed) {
    suppressionReason = `Donor count is below suppression threshold of ${threshold}.`;
  }

  return {
    isSuppressed,
    suppressionThreshold: threshold,
    suppressionReason,
    computedAt: new Date(),
  };
}

function roundAmount(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function normalizeStatsOptions(options = {}) {
  const beginningYear = Number.parseInt(options.beginningYear, 10);
  const endingYear = Number.parseInt(options.endingYear, 10);

  const safeBeginningYear = Number.isInteger(beginningYear)
    ? beginningYear
    : DEFAULT_BEGINNING_YEAR;
  const safeEndingYear = Number.isInteger(endingYear)
    ? endingYear
    : DEFAULT_ENDING_YEAR;

  return {
    beginningYear: Math.min(safeBeginningYear, safeEndingYear),
    endingYear: Math.max(safeBeginningYear, safeEndingYear),
    partyCode: String(options.partyCode || DEFAULT_PARTY_CODE).toUpperCase(),
    metricMode:
      options.metricMode === "per_capita" ? "per_capita" : DEFAULT_METRIC_MODE,
    boundarySet: options.boundarySet || undefined,
  };
}

function createEmptyTotals(population = 0) {
  return {
    totalDonations: 0,
    donationCount: 0,
    donorCount: 0,
    averageDonation: 0,
    perCapitaAmount: 0,
    population: Number(population || 0),
  };
}

function calculatePerCapita(totalDonations, population) {
  const pop = Number(population || 0);
  if (!pop) return 0;
  return roundAmount(totalDonations / pop);
}

function normalizeTotals(totals, metricMode) {
  const totalDonations = roundAmount(totals?.totalDonations || 0);
  const donationCount = totals?.donationCount || 0;
  const donorCount = totals?.donorCount || 0;
  const population = totals?.population || 0;

  return {
    totalDonations,
    donationCount,
    donorCount,
    averageDonation: donationCount
      ? roundAmount(totalDonations / donationCount)
      : 0,
    perCapitaAmount:
      metricMode === "per_capita"
        ? calculatePerCapita(totalDonations, population)
        : roundAmount(totals?.perCapitaAmount || calculatePerCapita(totalDonations, population)),
    population,
  };
}

function getPartyRows(doc, partyCode) {
  const rows = doc.partyStats || [];

  if (partyCode === "ALL") return rows;

  return rows.filter((party) => party.partyCode === partyCode);
}

function totalsForDocument(doc, partyCode, metricMode) {
  if (partyCode === "ALL") {
    return normalizeTotals(doc.totals || createEmptyTotals(), metricMode);
  }

  const matchingParties = getPartyRows(doc, partyCode);
  const totalDonations = matchingParties.reduce(
    (sum, party) => sum + (party.totalDonations || 0),
    0,
  );
  const donationCount = matchingParties.reduce(
    (sum, party) => sum + (party.donationCount || 0),
    0,
  );
  const donorCount = matchingParties.reduce(
    (sum, party) => sum + (party.donorCount || 0),
    0,
  );

  return normalizeTotals(
    {
      totalDonations,
      donationCount,
      donorCount,
      population: doc.totals?.population || 0,
    },
    metricMode,
  );
}

function combinePartyStats(group, partyCode) {
  const byParty = new Map();

  for (const doc of group) {
    for (const party of getPartyRows(doc, partyCode)) {
      const code = party.partyCode || "UNKNOWN";

      if (!byParty.has(code)) {
        byParty.set(code, {
          partyCode: code,
          partyName: party.partyName || "Unknown Party",
          totalDonations: 0,
          donationCount: 0,
          donorCount: 0,
        });
      }

      const current = byParty.get(code);
      current.totalDonations += party.totalDonations || 0;
      current.donationCount += party.donationCount || 0;
      current.donorCount += party.donorCount || 0;
    }
  }

  return [...byParty.values()]
    .map((party) => ({
      ...party,
      totalDonations: roundAmount(party.totalDonations),
    }))
    .sort((a, b) => b.totalDonations - a.totalDonations);
}

function combineRegionStatDocuments(group, options = {}) {
  const filters = normalizeStatsOptions(options);

  if (!group.length) return null;

  const sorted = [...group].sort(
    (a, b) => a.filters.beginningYear - b.filters.beginningYear,
  );
  const first = sorted[0];
  const totals = createEmptyTotals(first.totals?.population || 0);
  const donationsTrend = [];

  for (const doc of sorted) {
    const docTotals = totalsForDocument(
      doc,
      filters.partyCode,
      filters.metricMode,
    );

    totals.totalDonations += docTotals.totalDonations;
    totals.donationCount += docTotals.donationCount;
    totals.donorCount += docTotals.donorCount;
    totals.population = docTotals.population || totals.population || 0;

    const trendYear = doc.donationsTrend?.[0]?.year || doc.filters.beginningYear;
    donationsTrend.push({
      year: trendYear,
      totalDonations: docTotals.totalDonations,
      donationCount: docTotals.donationCount,
      donorCount: docTotals.donorCount,
      perCapitaAmount: docTotals.perCapitaAmount,
    });
  }

  const normalizedTotals = normalizeTotals(totals, filters.metricMode);

  return {
    region: first.region,
    filters: {
      beginningYear: filters.beginningYear,
      endingYear: filters.endingYear,
      partyCode: filters.partyCode,
      metricMode: filters.metricMode,
    },
    totals: normalizedTotals,
    partyStats: combinePartyStats(sorted, filters.partyCode),
    donationsTrend,
    privacy: buildPrivacy(normalizedTotals.donorCount),
  };
}

function buildBaseQuery({ level, code, provinceCode, boundarySet, beginningYear, endingYear }) {
  const query = {
    "region.level": level,
    "filters.partyCode": DEFAULT_PARTY_CODE,
    "filters.metricMode": DEFAULT_METRIC_MODE,
    "filters.beginningYear": { $gte: beginningYear },
    "filters.endingYear": { $lte: endingYear },
  };

  if (code) query["region.code"] = String(code).toUpperCase();
  if (provinceCode) query["region.provinceCode"] = String(provinceCode).toUpperCase();
  if (boundarySet) query["region.boundarySet"] = boundarySet;

  return query;
}

function buildExactRangeQuery({ level, code, provinceCode, boundarySet, beginningYear, endingYear }) {
  const query = {
    "region.level": level,
    "filters.partyCode": DEFAULT_PARTY_CODE,
    "filters.metricMode": DEFAULT_METRIC_MODE,
    "filters.beginningYear": beginningYear,
    "filters.endingYear": endingYear,
  };

  if (code) query["region.code"] = String(code).toUpperCase();
  if (provinceCode) query["region.provinceCode"] = String(provinceCode).toUpperCase();
  if (boundarySet) query["region.boundarySet"] = boundarySet;

  return query;
}

function withAnnualOnly(query) {
  return {
    ...query,
    $expr: { $eq: ["$filters.beginningYear", "$filters.endingYear"] },
  };
}

async function findAnnualRegionStats(query) {
  return RegionStat.find(withAnnualOnly(query))
    .select(SELECT_PUBLIC_STATS)
    .sort({ "region.code": 1, "filters.beginningYear": 1 })
    .lean();
}

async function findExactRangeRegionStats(query) {
  return RegionStat.find(query)
    .select(SELECT_PUBLIC_STATS)
    .sort({ "region.code": 1, "filters.beginningYear": 1 })
    .lean();
}

function groupDocsByRegionCode(docs) {
  const byRegion = new Map();

  for (const doc of docs) {
    const code = doc.region.code;
    if (!byRegion.has(code)) byRegion.set(code, []);
    byRegion.get(code).push(doc);
  }

  return byRegion;
}

async function findCombinedStatsForQuery(queryOptions, filters) {
  const baseQuery = buildBaseQuery(queryOptions);
  const annualDocs = await findAnnualRegionStats(baseQuery);

  if (annualDocs.length) {
    return combineRegionStatDocuments(annualDocs, filters);
  }

  const exactRangeDocs = await findExactRangeRegionStats(
    buildExactRangeQuery(queryOptions),
  );

  if (exactRangeDocs.length) {
    return combineRegionStatDocuments(exactRangeDocs, filters);
  }

  return null;
}

async function findCombinedStatsCollection(queryOptions, filters) {
  const baseQuery = buildBaseQuery(queryOptions);
  const annualDocs = await findAnnualRegionStats(baseQuery);
  const docs = annualDocs.length
    ? annualDocs
    : await findExactRangeRegionStats(buildExactRangeQuery(queryOptions));

  const byRegion = groupDocsByRegionCode(docs);

  return [...byRegion.values()]
    .map((group) => combineRegionStatDocuments(group, filters))
    .filter(Boolean);
}

async function getAllProvinceStats(options = {}) {
  const filters = normalizeStatsOptions(options);

  return findCombinedStatsCollection(
    {
      level: "province",
      beginningYear: filters.beginningYear,
      endingYear: filters.endingYear,
    },
    filters,
  );
}

async function getNationalStats(options = {}) {
  const filters = normalizeStatsOptions(options);

  return findCombinedStatsForQuery(
    {
      level: "national",
      code: "CA",
      beginningYear: filters.beginningYear,
      endingYear: filters.endingYear,
    },
    filters,
  );
}

async function getRegionStats(level, code, options = {}) {
  const filters = normalizeStatsOptions(options);

  return findCombinedStatsForQuery(
    {
      level,
      code,
      boundarySet: level === "riding" ? filters.boundarySet : undefined,
      beginningYear: filters.beginningYear,
      endingYear: filters.endingYear,
    },
    filters,
  );
}

async function getRidingStatsForProvince(provinceCode, options = {}) {
  const filters = normalizeStatsOptions(options);

  return findCombinedStatsCollection(
    {
      level: "riding",
      provinceCode,
      boundarySet: filters.boundarySet,
      beginningYear: filters.beginningYear,
      endingYear: filters.endingYear,
    },
    filters,
  );
}

module.exports = {
  getAllProvinceStats,
  getNationalStats,
  getRegionStats,
  getRidingStatsForProvince,
  combineRegionStatDocuments,
  normalizeStatsOptions,
};
