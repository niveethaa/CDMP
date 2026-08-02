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

function optionsForPeriod(
  query,
  beginningYear,
  endingYear,
  partyCode = query.partyCodes[0] || "ALL",
) {
  return {
    beginningYear,
    endingYear,
    partyCode,
    metricMode: query.metric === "perCapitaAmount" ? "per_capita" : "total",
    boundarySet: query.boundarySet || undefined,
  };
}

function optionsForQuery(query, partyCode = query.partyCodes[0] || "ALL") {
  return optionsForPeriod(
    query,
    query.beginningYear,
    query.endingYear,
    partyCode,
  );
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

async function loadSingleRegion(query, partyCode) {
  const options = optionsForQuery(query, partyCode);

  if (query.regionLevel === "national") {
    return getNationalStats(options);
  }

  if (query.regionLevel === "riding" && !/^\d+$/.test(query.regionCode || "")) {
    const ridingStats = await getRidingStatsForProvince(
      query.provinceCode,
      options,
    );
    const requestedRiding = normalizeName(query.regionCode);
    return ridingStats.find((item) =>
      [item.region?.code, item.region?.name]
        .map(normalizeName)
        .includes(requestedRiding),
    ) || null;
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
  const unavailable =
    metric === "perCapitaAmount"
    && Number(source?.population || 0) <= 0;
  const unavailableReason = unavailable
    ? "Population data is unavailable for this selection."
    : "";

  return {
    label: label || "Unknown",
    value: normalizedPrivacy.isSuppressed || unavailable
      ? null
      : metricValue(source, metric),
    suppressed: normalizedPrivacy.isSuppressed,
    suppressionReason: normalizedPrivacy.reason,
    unavailable,
    unavailableReason,
  };
}

function coverageNotes(query) {
  const notes = [];
  const selectedParties = query.partyCodes || [];
  const includesAllParties = selectedParties.length === 0;
  if (
    query.beginningYear <= 2020
    && query.endingYear >= 2020
    && (includesAllParties || selectedParties.includes("CPC"))
  ) {
    notes.push("The imported 2020 data does not include Conservative Party records.");
  }
  if (
    query.beginningYear <= 2021
    && query.endingYear >= 2021
    && (includesAllParties || selectedParties.includes("LPC"))
  ) {
    notes.push("The imported 2021 data does not include Liberal Party records.");
  }
  if (
    query.beginningYear <= 2024
    && query.endingYear >= 2024
    && (includesAllParties || selectedParties.some((code) => code !== "BQ"))
  ) {
    notes.push("The imported 2024 data currently includes Bloc Québécois records only.");
  }
  if (query.metric === "perCapitaAmount") {
    notes.push("Population data is unavailable, so per-capita values cannot be calculated.");
  }
  return notes;
}

function responseFor(query, rows, privacy) {
  const notes = coverageNotes(query);
  return {
    query,
    columns: ["label", query.metric],
    rows,
    privacy,
    coverage: {
      beginningYear: DATA_BEGINNING_YEAR,
      endingYear: DATA_ENDING_YEAR,
      isComplete: notes.length === 0,
      notes,
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
      population,
    };
    return visibleRow(
      party.partyName || party.partyCode,
      source,
      query.metric,
      privacyForDonorCount(party.donorCount),
    );
  });
}

function trendRowsFromStats(stats, query, series = null) {
  return (stats?.donationsTrend || []).map((year) => ({
    ...visibleRow(
      series ? `${year.year} · ${series}` : String(year.year),
      year,
      query.metric,
      privacyForDonorCount(year.donorCount),
    ),
    year: year.year,
    series,
  }));
}

function sortAndLimitRanking(rows, limit, sortOrder = "desc") {
  return [...rows]
    .sort((left, right) => {
      if (left.suppressed !== right.suppressed) {
        return left.suppressed ? 1 : -1;
      }
      const difference = Number(right.value || 0) - Number(left.value || 0);
      return sortOrder === "asc" ? -difference : difference;
    })
    .slice(0, Math.min(limit, 10));
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
  } else if (query.groupBy === "year") {
    const stats = await loadSingleRegion(query);
    rows = trendRowsFromStats(stats, query);
  } else {
    const stats = await loadSingleRegion(query, "ALL");
    rows = rankingRowsFromPartyStats(stats, query);
  }

  const limitedRows = sortAndLimitRanking(rows, query.limit, query.sortOrder);
  return responseFor(query, limitedRows, combinedPrivacy(limitedRows));
}

async function executeTrend(query) {
  let rows;

  if (query.partyCodes.length > 1) {
    const statsByParty = await Promise.all(
      query.partyCodes.map(async (partyCode) => ({
        partyCode,
        stats: await loadSingleRegion(query, partyCode),
      })),
    );
    rows = statsByParty.flatMap(({ partyCode, stats }) =>
      trendRowsFromStats(stats, query, partyCode),
    );
  } else {
    const stats = await loadSingleRegion(query);
    rows = trendRowsFromStats(stats, query);
  }

  return responseFor(query, rows, combinedPrivacy(rows));
}

async function executePartyComparison(query) {
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

async function executeProvinceComparison(query) {
  const statsByProvince = await Promise.all(
    query.regionCodes.map(async (regionCode) => ({
      regionCode,
      stats: await getRegionStats(
        "province",
        regionCode,
        optionsForQuery(query),
      ),
    })),
  );

  const rows = statsByProvince.map(({ regionCode, stats }) =>
    stats
      ? visibleRow(
          stats.region?.name || regionCode,
          stats.totals,
          query.metric,
          stats.privacy,
        )
      : visibleRow(regionCode, null, query.metric, null),
  );

  return responseFor(query, rows, combinedPrivacy(rows));
}

async function executeYearComparison(query) {
  const years = [query.beginningYear, query.endingYear];
  const statsByYear = await Promise.all(
    years.map(async (year) => ({
      year,
      stats: await loadSingleRegion({
        ...query,
        beginningYear: year,
        endingYear: year,
      }),
    })),
  );

  const rows = statsByYear.map(({ year, stats }) =>
    stats
      ? visibleRow(String(year), stats.totals, query.metric, stats.privacy)
      : visibleRow(String(year), null, query.metric, null),
  );

  return responseFor(query, rows, combinedPrivacy(rows));
}

async function executeComparison(query) {
  if (query.groupBy === "province") {
    return executeProvinceComparison(query);
  }
  if (query.groupBy === "year") {
    return executeYearComparison(query);
  }
  return executePartyComparison(query);
}

function changeRow(label, startSource, endSource, metric, startPrivacy, endPrivacy) {
  const normalizedStartPrivacy = normalizePrivacy(
    startPrivacy,
    startSource?.donorCount,
  );
  const normalizedEndPrivacy = normalizePrivacy(
    endPrivacy,
    endSource?.donorCount,
  );
  const suppressed =
    normalizedStartPrivacy.isSuppressed || normalizedEndPrivacy.isSuppressed;
  const unavailable = metric === "perCapitaAmount" && (
    Number(startSource?.population || 0) <= 0
    || Number(endSource?.population || 0) <= 0
  );
  const startValue = suppressed || unavailable ? null : metricValue(startSource, metric);
  const endValue = suppressed || unavailable ? null : metricValue(endSource, metric);

  return {
    label: label || "Unknown",
    value: suppressed || unavailable ? null : endValue - startValue,
    startValue,
    endValue,
    suppressed,
    suppressionReason: suppressed
      ? normalizedStartPrivacy.reason || normalizedEndPrivacy.reason
      : "",
    unavailable,
    unavailableReason: unavailable
      ? "Population data is unavailable for this selection."
      : "",
  };
}

function partySources(stats) {
  const population = Number(stats?.totals?.population || 0);
  return new Map((stats?.partyStats || []).map((party) => [
    party.partyCode,
    {
      ...party,
      averageDonation: metricValue(party, "averageDonation"),
      perCapitaAmount: population
        ? Number(party.totalDonations || 0) / population
        : 0,
      population,
    },
  ]));
}

async function executePartyChange(query) {
  const [startStats, endStats] = await Promise.all([
    loadSingleRegion({
      ...query,
      beginningYear: query.beginningYear,
      endingYear: query.beginningYear,
    }, "ALL"),
    loadSingleRegion({
      ...query,
      beginningYear: query.endingYear,
      endingYear: query.endingYear,
    }, "ALL"),
  ]);
  const startParties = partySources(startStats);
  const endParties = partySources(endStats);
  const partyCodes = query.partyCodes.length
    ? query.partyCodes
    : [...new Set([...startParties.keys(), ...endParties.keys()])];
  const rows = partyCodes.map((partyCode) => {
    const startParty = startParties.get(partyCode);
    const endParty = endParties.get(partyCode);
    return changeRow(
      endParty?.partyName || startParty?.partyName || partyCode,
      startParty,
      endParty,
      query.metric,
      privacyForDonorCount(startParty?.donorCount),
      privacyForDonorCount(endParty?.donorCount),
    );
  });
  const limitedRows = sortAndLimitRanking(rows, query.limit, query.sortOrder);
  return responseFor(query, limitedRows, combinedPrivacy(limitedRows));
}

async function executeProvinceChange(query) {
  const [startStats, endStats] = await Promise.all([
    getAllProvinceStats(optionsForPeriod(
      query,
      query.beginningYear,
      query.beginningYear,
    )),
    getAllProvinceStats(optionsForPeriod(
      query,
      query.endingYear,
      query.endingYear,
    )),
  ]);
  const startByCode = new Map(startStats.map((item) => [item.region?.code, item]));
  const endByCode = new Map(endStats.map((item) => [item.region?.code, item]));
  const regionCodes = query.regionCodes.length
    ? query.regionCodes
    : [...new Set([...startByCode.keys(), ...endByCode.keys()])];
  const rows = regionCodes.map((regionCode) => {
    const start = startByCode.get(regionCode);
    const end = endByCode.get(regionCode);
    return changeRow(
      end?.region?.name || start?.region?.name || regionCode,
      start?.totals,
      end?.totals,
      query.metric,
      start?.privacy,
      end?.privacy,
    );
  });
  const limitedRows = sortAndLimitRanking(rows, query.limit, query.sortOrder);
  return responseFor(query, limitedRows, combinedPrivacy(limitedRows));
}

async function executeChange(query) {
  return query.groupBy === "province"
    ? executeProvinceChange(query)
    : executePartyChange(query);
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
    case "change":
      return executeChange(query);
    default:
      throw new Error("Unsupported validated query intent.");
  }
}

module.exports = {
  executeQuerySpec,
};
