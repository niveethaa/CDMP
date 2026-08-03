import { PARTY_COLORS } from "../../utils/partyColors";
import { formatDollars, formatCount as formatNumber } from "../../utils/format";

function getRegionLevelLabel(level) {
  if (level === "national") return "National Overview";
  if (level === "province") return "Province / Territory";
  if (level === "riding") return "Federal Riding";
  return "Region";
}

function hasUsableData(totals = {}) {
  return (
    Number(totals.totalDonations || 0) > 0 ||
    Number(totals.donationCount || 0) > 0 ||
    Number(totals.donorCount || 0) > 0
  );
}

export default function RegionSummaryPanel({ stats, onBack, loading }) {
  if (loading) {
    return (
      <div className="panel-state">
        <div className="panel-spinner" />
        <p>Loading region data…</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="panel-state panel-empty">
        <div className="panel-empty-icon">⌖</div>
        <p>Click a province or territory on the map to open riding-level donation data.</p>
      </div>
    );
  }

  const { region, totals = {}, partyStats = [], donationsTrend, privacy, filters } = stats;
  const visiblePartyStats = partyStats.filter((party) => party.partyCode?.toUpperCase() !== "UNKNOWN");
  const isNational = region?.level === "national";
  const isDonationCount = filters?.metricMode === "donation_count";
  const isRiding = region?.level === "riding";
  const partyMetricKey = isDonationCount ? "donationCount" : "totalDonations";
  const maxParty = visiblePartyStats.reduce((m, p) => Math.max(m, p[partyMetricKey] || 0), 1);
  const trendMetricKey = isDonationCount ? "donationCount" : "totalDonations";
  const maxTrend = (donationsTrend || []).reduce(
    (m, t) => Math.max(m, t[trendMetricKey] || 0),
    1,
  );
  const noDataMessage = stats._noDataMessage;
  const isSuppressed = Boolean(privacy?.isSuppressed);
  const showNoDataHint = !noDataMessage && !hasUsableData(totals) && !isSuppressed;

  return (
    <div className="region-panel">
      <div className="panel-header panel-header--dashboard">
        <div className="panel-header-text">
          <p className="panel-eyebrow">{getRegionLevelLabel(region?.level)}</p>
          <h2 className="panel-title">{region?.name}</h2>
        </div>
        {!isNational && (
          <button className="back-btn" onClick={onBack}>
            {isRiding ? "← Province" : "← Canada"}
          </button>
        )}
      </div>

      {privacy?.isSuppressed && (
        <div className="suppression-notice">
          {privacy.suppressionReason}
        </div>
      )}

      {noDataMessage && (
        <div className="no-data-notice">
          {noDataMessage}
        </div>
      )}

      {showNoDataHint && (
        <div className="no-data-notice">
          No donation data is available for this selection. Try selecting all parties or expanding the year range.
        </div>
      )}

      {!isSuppressed && (
        <>
      <div className="stats-grid stats-grid--dashboard">
        <StatCard
          label={isDonationCount ? "Donation Count" : "Total Donations"}
          value={isDonationCount ? formatNumber(totals?.donationCount) : formatDollars(totals?.totalDonations)}
          accent
        />
        <StatCard
          label={isDonationCount ? "Total Donations" : "Donation Count"}
          value={isDonationCount ? formatDollars(totals?.totalDonations) : formatNumber(totals?.donationCount)}
        />
        <StatCard
          label="Unique Donors"
          value={formatNumber(totals?.donorCount)}
        />
        <StatCard
          label="Average Donation"
          value={formatDollars(totals?.averageDonation)}
        />
        {totals?.population ? (
          <StatCard
            label="Population"
            value={formatNumber(totals.population)}
          />
        ) : null}
      </div>

      <section className="panel-section">
        <div className="section-header-row">
          <h3 className="section-title">Party Breakdown</h3>
          {visiblePartyStats.length > 0 && <span className="section-count">{visiblePartyStats.length} parties</span>}
        </div>
        {visiblePartyStats.length > 0 ? (
          visiblePartyStats.map((p) => (
            <PartyBar key={p.partyCode} party={p} maxValue={maxParty} metricMode={filters?.metricMode} />
          ))
        ) : (
          <div className="trend-empty">No party breakdown available for this selection.</div>
        )}
      </section>

      <section className="panel-section">
        <div className="section-header-row">
          <h3 className="section-title">{isDonationCount ? "Number of Donations by Year" : "Donations by Year"}</h3>
        </div>
        <TrendLineChart data={donationsTrend} maxTrend={maxTrend} metricMode={filters?.metricMode} />
      </section>
        </>
      )}
    </div>
  );
}

function TrendLineChart({ data, maxTrend, metricMode }) {
  if (!data || data.length === 0) {
    return <div className="trend-empty">No trend data available for this selection.</div>;
  }

  const W = 320;
  const H = 150;
  const padTop = 10;
  const padLeft = 58;
  const padRight = 8;
  const padBottom = 34;

  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;
  const baseY = padTop + plotH;
  const baseX = padLeft;
  const niceMax = niceCeil(maxTrend);
  const isDonationCount = metricMode === "donation_count";
  const metricKey = isDonationCount ? "donationCount" : "totalDonations";
  const yAxisTitle = isDonationCount ? "Donations" : "Amount (CAD)";
  const formatMetric = isDonationCount ? formatNumber : formatDollars;
  const n = data.length;
  const xTickStep = Math.max(1, Math.ceil((n - 1) / 4));
  const x = (i) => padLeft + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v) => padTop + plotH - (v / niceMax) * plotH;
  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => (niceMax / yTickCount) * i);
  const points = data.map((t, i) => ({
    ...t,
    metricValue: t[metricKey] || 0,
    cx: x(i),
    cy: y(t[metricKey] || 0),
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.cx.toFixed(2)} ${p.cy.toFixed(2)}`)
    .join(" ");
  const areaPath =
    `M ${points[0].cx.toFixed(2)} ${baseY.toFixed(2)} ` +
    points.map((p) => `L ${p.cx.toFixed(2)} ${p.cy.toFixed(2)}`).join(" ") +
    ` L ${points[points.length - 1].cx.toFixed(2)} ${baseY.toFixed(2)} Z`;

  return (
    <svg
      className="trend-line-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={isDonationCount ? "Number of donations by year line chart" : "Donations by year line chart"}
    >
      <defs>
        <linearGradient id="trendAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#4361ee" stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((v, i) => {
        const ty = y(v);
        return (
          <g key={`y-${i}`}>
            <line x1={baseX} y1={ty} x2={W - padRight} y2={ty} className="trend-gridline" />
            <text x={baseX - 8} y={ty + 3} className="trend-axis-label" textAnchor="end">
              {formatMetric(v)}
            </text>
          </g>
        );
      })}

      <text
        className="trend-axis-title"
        transform={`translate(10 ${padTop + plotH / 2}) rotate(-90)`}
        textAnchor="middle"
      >
        {yAxisTitle}
      </text>

      <line x1={baseX} y1={padTop} x2={baseX} y2={baseY} className="trend-axis" />
      <line x1={baseX} y1={baseY} x2={W - padRight} y2={baseY} className="trend-axis" />

      <path d={areaPath} fill="url(#trendAreaFill)" />
      <path
        d={linePath}
        fill="none"
        stroke="#818cf8"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {points.map((p) => (
        <g key={p.year} className="trend-point">
          <circle cx={p.cx} cy={p.cy} r="2.5" fill="#4361ee" stroke="#fff" strokeWidth="1" />
          <title>{`${p.year}: ${formatMetric(p.metricValue)}`}</title>
        </g>
      ))}

      {points.map((p, i) =>
        i === 0 || i === n - 1 || i % xTickStep === 0 ? (
          <g key={`x-${p.year}`}>
            <line x1={p.cx} y1={baseY} x2={p.cx} y2={baseY + 4} className="trend-axis" />
            <text x={p.cx} y={baseY + 14} className="trend-axis-label" textAnchor="middle">
              {p.year}
            </text>
          </g>
        ) : null,
      )}

      <text className="trend-axis-title" x={baseX + plotW / 2} y={H - 2} textAnchor="middle">
        Year
      </text>
    </svg>
  );
}

function niceCeil(value) {
  if (!value || value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const frac = value / base;
  let niceFrac;
  if (frac <= 1) niceFrac = 1;
  else if (frac <= 2) niceFrac = 2;
  else if (frac <= 2.5) niceFrac = 2.5;
  else if (frac <= 5) niceFrac = 5;
  else niceFrac = 10;
  return niceFrac * base;
}

function StatCard({ label, value, accent }) {
  return (
    <div className={`stat-card${accent ? " stat-card--accent" : ""}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function PartyBar({ party, maxValue, metricMode }) {
  const color = PARTY_COLORS[party.partyCode] || PARTY_COLORS.UNKNOWN;
  const isDonationCount = metricMode === "donation_count";
  const value = (isDonationCount ? party.donationCount : party.totalDonations) || 0;
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <div className="party-row">
      <span className="party-dot" style={{ background: color }} />
      <span className="party-code">{party.partyCode}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="party-amount">
        {isDonationCount ? formatNumber(value) : formatDollars(value)}
      </span>
    </div>
  );
}
