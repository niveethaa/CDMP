const {
  getAllProvinceStats,
  getNationalStats,
  getRegionStats,
  getRidingStatsForProvince,
} = require("./regionStats.service");
const {
  DATA_BEGINNING_YEAR,
  DATA_ENDING_YEAR,
  validateQuerySpec,
} = require("./querySpec.service");

function optionsForQuery(query, partyCode = query.partyCodes[0] || "ALL") {
  return {
    beginningYear: query.beginningYear,
    endingYear: query.endingYear,
    partyCode,
    metricMode: query.metric === "perCapitaAmount" ? "per_capita" : "total",
    boundarySet: query.boundarySet || undefined,
  };
}

async function loadSingleRegion(query, partyCode) {
  const options = optionsForQuery(query, partyCode);

  if (query.regionLevel === "national") {
    return getNationalStats(options);
  }

  return getRegionStats(query.regionLevel, query.regionCode, options);
}

function metricValue(source, metric) {
  if (!source) return 0;
  if (metric === "averageDonation") {
    const count = Number(source.donationCount || 0);
    return count ? Number(source.totalDonations || 0) / count : 0;
  }
  return Number(source[metric] || 0);
}

function privacyForDonorCount(donorCount) {
  const count = Number(donorCount || 0);
  const isSuppressed = count < 5;

  return {
    isSuppressed,
    reason: isSuppressed
      ? count === 0
        ? "No aggregate data is available for this selection."
        : "The result is below the privacy suppression threshold."
      : "",
  };
}

function normalizePrivacy(privacy, fallbackDonorCount = 0) {
  if (!privacy) return privacyForDonorCount(fallbackDonorCount);

  return {
    isSuppressed: Boolean(privacy.isSuppressed),
    reason: privacy.suppressionReason || "",
  };
}

function visibleRow(label, source, metric, privacy) {
  const normalizedPrivacy = normalizePrivacy(privacy, source?.donorCount);

  return {
    label: label || "Unknown",
    value: normalizedPrivacy.isSuppressed ? null : metricValue(source, metric),
    suppressed: normalizedPrivacy.isSuppressed,
    suppressionReason: normalizedPrivacy.reason,
  };
}

function responseFor(query, rows, privacy) {
  return {
    query,
    columns: ["label", query.metric],
    rows,
    privacy,
    coverage: {
      beginningYear: DATA_BEGINNING_YEAR,
      endingYear: DATA_ENDING_YEAR,
    },
  };
}

function combinedPrivacy(rows) {
  const suppressedRow = rows.find((row) => row.suppressed);
  return {
    isSuppressed: Boolean(suppressedRow),
    reason: suppressedRow?.suppressionReason || "",
  };
}

async function executeSummary(query) {
  const stats = await loadSingleRegion(query);
  if (!stats) return responseFor(query, [], normalizePrivacy(null, 0));

  const row = visibleRow(
    stats.region?.name || stats.region?.code,
    stats.totals,
    query.metric,
    stats.privacy,
  );

  return responseFor(query, [row], combinedPrivacy([row]));
}

function rankingRowsFromRegionStats(stats, query) {
  return stats.map((item) =>
    visibleRow(
      item.region?.name || item.region?.code,
      item.totals,
      query.metric,
      item.privacy,
    ),
  );
}

function rankingRowsFromPartyStats(stats, query) {
  const population = Number(stats?.totals?.population || 0);
  let partyStats = stats?.partyStats || [];

  if (query.partyCodes.length) {
    partyStats = partyStats.filter((party) =>
      query.partyCodes.includes(party.partyCode),
    );
  }

  return partyStats.map((party) => {
    const source = {
      ...party,
      averageDonation: metricValue(party, "averageDonation"),
      perCapitaAmount: population
        ? Number(party.totalDonations || 0) / population
        : 0,
    };
    return visibleRow(
      party.partyName || party.partyCode,
      source,
      query.metric,
      privacyForDonorCount(party.donorCount),
    );
  });
}

function sortAndLimitRanking(rows, limit) {
  return [...rows]
    .sort((left, right) => {
      if (left.suppressed !== right.suppressed) {
        return left.suppressed ? 1 : -1;
      }
      return Number(right.value || 0) - Number(left.value || 0);
    })
    .slice(0, Math.min(limit, 5));
}

async function executeRanking(query) {
  let rows;

  if (query.groupBy === "province") {
    const stats = await getAllProvinceStats(optionsForQuery(query));
    rows = rankingRowsFromRegionStats(stats, query);
  } else if (query.groupBy === "riding") {
    const stats = await getRidingStatsForProvince(
      query.provinceCode,
      optionsForQuery(query),
    );
    rows = rankingRowsFromRegionStats(stats, query);
  } else {
    const stats = await loadSingleRegion(query, "ALL");
    rows = rankingRowsFromPartyStats(stats, query);
  }

  const limitedRows = sortAndLimitRanking(rows, query.limit);
  return responseFor(query, limitedRows, combinedPrivacy(limitedRows));
}

async function executeTrend(query) {
  const stats = await loadSingleRegion(query);
  if (!stats) return responseFor(query, [], normalizePrivacy(null, 0));

  const rows = (stats.donationsTrend || []).map((year) =>
    visibleRow(
      String(year.year),
      year,
      query.metric,
      privacyForDonorCount(year.donorCount),
    ),
  );

  return responseFor(query, rows, combinedPrivacy(rows));
}

async function executeComparison(query) {
  const statsByParty = await Promise.all(
    query.partyCodes.map(async (partyCode) => ({
      partyCode,
      stats: await loadSingleRegion(query, partyCode),
    })),
  );

  const rows = statsByParty.map(({ partyCode, stats }) =>
    stats
      ? visibleRow(partyCode, stats.totals, query.metric, stats.privacy)
      : {
          label: partyCode,
          value: null,
          suppressed: true,
          suppressionReason: "No aggregate data is available for this selection.",
        },
  );

  return responseFor(query, rows, combinedPrivacy(rows));
}

async function executeQuerySpec(input) {
  const query = validateQuerySpec(input);

  switch (query.intent) {
    case "summary":
      return executeSummary(query);
    case "ranking":
      return executeRanking(query);
    case "trend":
      return executeTrend(query);
    case "comparison":
      return executeComparison(query);
    default:
      throw new Error("Unsupported validated query intent.");
  }
}

module.exports = {
  executeQuerySpec,
};
