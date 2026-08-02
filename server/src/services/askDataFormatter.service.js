const DOLLAR_METRICS = new Set([
  "totalDonations",
  "averageDonation",
  "perCapitaAmount",
]);

const METRIC_LABELS = Object.freeze({
  totalDonations: "total donations",
  donationCount: "donations",
  donorCount: "donors",
  averageDonation: "average donation",
  perCapitaAmount: "per-capita donations",
});

function formatDollars(value) {
  const amount = Number(value || 0);
  const sign = amount < 0 ? "-" : "";
  const absoluteAmount = Math.abs(amount);
  if (absoluteAmount >= 1_000_000) {
    return `${sign}$${(absoluteAmount / 1_000_000).toFixed(1)}M`;
  }
  if (absoluteAmount >= 1_000) {
    return `${sign}$${(absoluteAmount / 1_000).toFixed(0)}K`;
  }
  return `${sign}$${absoluteAmount.toFixed(0)}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-CA");
}

function metricLabel(metric) {
  return METRIC_LABELS[metric] || metric;
}

function formatValue(value, metric) {
  if (value === null || value === undefined) return "suppressed";
  return DOLLAR_METRICS.has(metric) ? formatDollars(value) : formatNumber(value);
}

function periodLabel(beginningYear, endingYear) {
  return beginningYear === endingYear
    ? String(beginningYear)
    : `${beginningYear}–${endingYear}`;
}

function visibleRows(rows) {
  return rows.filter((row) => !row.suppressed && !row.unavailable);
}

function noDataMessage() {
  return "No data is available for this selection.";
}

function suppressedMessage() {
  return "All results are below the privacy suppression threshold.";
}

function unavailableMessage(rows) {
  return rows.find((row) => row.unavailable)?.unavailableReason
    || "The requested data is unavailable.";
}

function formatSummary(query, rows) {
  const row = rows[0];
  if (!row) return noDataMessage();
  if (row.unavailable) return unavailableMessage(rows);
  if (row.suppressed) {
    return `The result for ${row.label} is below the privacy suppression threshold.`;
  }
  return `${row.label} had ${formatValue(row.value, query.metric)} in ${metricLabel(query.metric)} between ${periodLabel(query.beginningYear, query.endingYear)}.`;
}

function formatRanking(query, rows) {
  if (!rows.length) return noDataMessage();
  const visible = visibleRows(rows);
  if (!visible.length && rows.some((row) => row.unavailable)) {
    return unavailableMessage(rows);
  }
  if (!visible.length) return suppressedMessage();
  const [top, ...rest] = visible;
  const label = metricLabel(query.metric);
  const period = periodLabel(query.beginningYear, query.endingYear);
  const direction = query.sortOrder === "asc" ? "lowest" : "highest";
  if (!rest.length) {
    return `${top.label} had the ${direction} ${label} with ${formatValue(top.value, query.metric)} between ${period}.`;
  }
  const others = rest
    .map((row) => `${row.label} (${formatValue(row.value, query.metric)})`)
    .join(", ");
  return `${top.label} had the ${direction} ${label} with ${formatValue(top.value, query.metric)} between ${period}, followed by ${others}.`;
}

function formatTrend(query, rows) {
  if (!rows.length) return noDataMessage();
  const visible = visibleRows(rows);
  if (!visible.length && rows.some((row) => row.unavailable)) {
    return unavailableMessage(rows);
  }
  if (!visible.length) return suppressedMessage();
  const seriesNames = [...new Set(visible.map((row) => row.series).filter(Boolean))];
  if (seriesNames.length) {
    const label = metricLabel(query.metric);
    return seriesNames.map((series) => {
      const seriesRows = visible.filter((row) => row.series === series);
      const first = seriesRows[0];
      const last = seriesRows[seriesRows.length - 1];
      return `${series} ${label} went from ${formatValue(first.value, query.metric)} in ${first.year} to ${formatValue(last.value, query.metric)} in ${last.year}.`;
    }).join(" ");
  }
  const first = visible[0];
  const last = visible[visible.length - 1];
  const label = metricLabel(query.metric);
  return `${label} ranged from ${formatValue(first.value, query.metric)} in ${first.label} to ${formatValue(last.value, query.metric)} in ${last.label}.`;
}

function formatComparison(query, rows) {
  if (!rows.length) return noDataMessage();
  const visible = visibleRows(rows);
  if (!visible.length && rows.some((row) => row.unavailable)) {
    return unavailableMessage(rows);
  }
  if (!visible.length) return suppressedMessage();
  const label = metricLabel(query.metric);
  const period = periodLabel(query.beginningYear, query.endingYear);
  const values = visible.map(
    (row) => `${row.label} had ${formatValue(row.value, query.metric)}`,
  );
  const parts = values.length === 1
    ? values[0]
    : `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
  return `Between ${period}, ${parts} in ${label}.`;
}

function describeChange(row, metric) {
  const amount = Number(row.value || 0);
  const direction = amount >= 0 ? "increased" : "decreased";
  return `${row.label} ${direction} by ${formatValue(Math.abs(amount), metric)}`;
}

function formatChange(query, rows) {
  if (!rows.length) return noDataMessage();
  const visible = visibleRows(rows);
  if (!visible.length && rows.some((row) => row.unavailable)) {
    return unavailableMessage(rows);
  }
  if (!visible.length) return suppressedMessage();
  const period = periodLabel(query.beginningYear, query.endingYear);
  const descriptions = visible.map((row) => describeChange(row, query.metric));
  const result = descriptions.length === 1
    ? descriptions[0]
    : `${descriptions.slice(0, -1).join(", ")}, and ${descriptions.at(-1)}`;
  const groupLabel = query.groupBy === "province" ? "province" : "party";
  if (query.sortOrder === "desc" && Number(visible[0].value) < 0) {
    return `No ${groupLabel} increased between ${period}. The smallest decreases were: ${result}.`;
  }
  if (query.sortOrder === "asc" && Number(visible[0].value) > 0) {
    return `No ${groupLabel} decreased between ${period}. The smallest increases were: ${result}.`;
  }
  return `Between ${period}, ${result} in ${metricLabel(query.metric)}.`;
}

function formatAnswer(query, rows) {
  switch (query.intent) {
    case "summary":
      return formatSummary(query, rows);
    case "ranking":
      return formatRanking(query, rows);
    case "trend":
      return formatTrend(query, rows);
    case "comparison":
      return formatComparison(query, rows);
    case "change":
      return formatChange(query, rows);
    default:
      return "The question could not be answered.";
  }
}

module.exports = {
  formatAnswer,
  formatValue,
  metricLabel,
};
