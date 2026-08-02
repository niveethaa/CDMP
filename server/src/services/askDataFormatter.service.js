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
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
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
  return rows.filter((row) => !row.suppressed);
}

function noDataMessage() {
  return "No data is available for this selection.";
}

function suppressedMessage() {
  return "All results are below the privacy suppression threshold.";
}

function formatSummary(query, rows) {
  const row = rows[0];
  if (!row) return noDataMessage();
  if (row.suppressed) {
    return `The result for ${row.label} is below the privacy suppression threshold.`;
  }
  return `${row.label} had ${formatValue(row.value, query.metric)} in ${metricLabel(query.metric)} between ${periodLabel(query.beginningYear, query.endingYear)}.`;
}

function formatRanking(query, rows) {
  if (!rows.length) return noDataMessage();
  const visible = visibleRows(rows);
  if (!visible.length) return suppressedMessage();
  const [top, ...rest] = visible;
  const label = metricLabel(query.metric);
  const period = periodLabel(query.beginningYear, query.endingYear);
  if (!rest.length) {
    return `${top.label} had the highest ${label} with ${formatValue(top.value, query.metric)} between ${period}.`;
  }
  const others = rest
    .map((row) => `${row.label} (${formatValue(row.value, query.metric)})`)
    .join(", ");
  return `${top.label} had the highest ${label} with ${formatValue(top.value, query.metric)} between ${period}, followed by ${others}.`;
}

function formatTrend(query, rows) {
  if (!rows.length) return noDataMessage();
  const visible = visibleRows(rows);
  if (!visible.length) return suppressedMessage();
  const first = visible[0];
  const last = visible[visible.length - 1];
  const label = metricLabel(query.metric);
  return `${label} ranged from ${formatValue(first.value, query.metric)} in ${first.label} to ${formatValue(last.value, query.metric)} in ${last.label}.`;
}

function formatComparison(query, rows) {
  if (!rows.length) return noDataMessage();
  const visible = visibleRows(rows);
  if (!visible.length) return suppressedMessage();
  const label = metricLabel(query.metric);
  const period = periodLabel(query.beginningYear, query.endingYear);
  const parts = visible
    .map((row) => `${row.label} had ${formatValue(row.value, query.metric)}`)
    .join(" while ");
  return `Between ${period}, ${parts} in ${label}.`;
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
    default:
      return "The question could not be answered.";
  }
}

module.exports = {
  formatAnswer,
  formatValue,
  metricLabel,
};