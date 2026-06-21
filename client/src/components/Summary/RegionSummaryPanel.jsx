const PARTY_COLORS = {
  LPC: "#d71920",
  CPC: "#1a4782",
  NDP: "#f37021",
  BQ: "#003da5",
  GPC: "#3d9b35",
  PPC: "#6a0dad",
  UNKNOWN: "#64748b",
};

function formatDollars(amount) {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${Number(amount || 0).toFixed(0)}`;
}

function formatNumber(n) {
  return Number(n || 0).toLocaleString("en-CA");
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
        <p>Click any province or territory on the map to explore its donation data.</p>
      </div>
    );
  }

  const { region, totals, partyStats, donationsTrend, privacy } = stats;
  const isNational = region?.level === "national";
  const maxParty = partyStats?.[0]?.totalDonations || 1;
  const maxTrend = Math.max(
    ...(donationsTrend?.map((t) => t.totalDonations) || [1]),
    1
  );

  return (
    <div className="region-panel">
      {/* Header */}
      <div className="panel-header">
        <div className="panel-header-text">
          <p className="panel-eyebrow">
            {isNational ? "National Overview" : "Province / Territory"}
          </p>
          <h2 className="panel-title">{region?.name}</h2>
          <p className="panel-period">2004 – 2024 · All parties</p>
        </div>
        {!isNational && (
          <button className="back-btn" onClick={onBack}>
            Canada
          </button>
        )}
      </div>

      {privacy?.isSuppressed && (
        <div className="suppression-notice">
          {privacy.suppressionReason}
        </div>
      )}

      {/* Key stats */}
      <div className="stats-grid">
        <StatCard
          label="Total Donations"
          value={formatDollars(totals?.totalDonations)}
          accent
        />
        <StatCard
          label="# of Donations"
          value={formatNumber(totals?.donationCount)}
        />
        <StatCard
          label="Unique Donors"
          value={formatNumber(totals?.donorCount)}
        />
        <StatCard
          label="Avg Donation"
          value={formatDollars(totals?.averageDonation)}
        />
      </div>

      {/* Party breakdown */}
      <section className="panel-section">
        <h3 className="section-title">Party Breakdown</h3>
        {partyStats?.map((p) => (
          <PartyBar key={p.partyCode} party={p} maxTotal={maxParty} />
        ))}
      </section>

      {/* Trend */}
      <section className="panel-section">
        <h3 className="section-title">Yearly Trend (2004 – 2024)</h3>
        <TrendLineChart data={donationsTrend} maxTrend={maxTrend} />
      </section>
    </div>
  );
}

function TrendLineChart({ data, maxTrend }) {
  if (!data || data.length === 0) {
    return <div className="trend-empty">No trend data available.</div>;
  }

  // viewBox coordinate space. Aspect ratio is preserved (no horizontal
  // stretching) so axis text and tick marks stay undistorted.
  const W = 320;
  const H = 150;
  const padTop = 10; // headroom above the highest point
  const padLeft = 42; // gutter for Y-axis labels + title
  const padRight = 8;
  const padBottom = 34; // room for X-axis ticks + title

  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;
  const baseY = padTop + plotH; // y of the zero line
  const baseX = padLeft; // x of the axis

  // Build a "nice" Y scale rounded up to a clean top value.
  const niceMax = niceCeil(maxTrend);
  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) =>
    (niceMax / yTickCount) * i
  );

  const n = data.length;
  const x = (i) =>
    padLeft + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v) => padTop + plotH - (v / niceMax) * plotH;

  const points = data.map((t, i) => ({
    ...t,
    cx: x(i),
    cy: y(t.totalDonations),
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
      aria-label="Yearly donation trend line chart"
    >
      <defs>
        <linearGradient id="trendAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#4361ee" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Y-axis gridlines + value labels */}
      {yTicks.map((v, i) => {
        const ty = y(v);
        return (
          <g key={`y-${i}`}>
            <line
              x1={baseX}
              y1={ty}
              x2={W - padRight}
              y2={ty}
              className="trend-gridline"
            />
            <text
              x={baseX - 6}
              y={ty + 3}
              className="trend-axis-label"
              textAnchor="end"
            >
              {formatDollars(v)}
            </text>
          </g>
        );
      })}

      {/* Y-axis title (rotated) */}
      <text
        className="trend-axis-title"
        transform={`translate(10 ${padTop + plotH / 2}) rotate(-90)`}
        textAnchor="middle"
      >
        Donations
      </text>

      {/* Axis lines */}
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
          <title>{`${p.year}: ${formatDollars(p.totalDonations)}`}</title>
        </g>
      ))}

      {/* X-axis tick labels (every 4th year) */}
      {points.map((p) =>
        p.year % 4 === 0 ? (
          <g key={`x-${p.year}`}>
            <line
              x1={p.cx}
              y1={baseY}
              x2={p.cx}
              y2={baseY + 4}
              className="trend-axis"
            />
            <text
              x={p.cx}
              y={baseY + 14}
              className="trend-axis-label"
              textAnchor="middle"
            >
              {p.year}
            </text>
          </g>
        ) : null
      )}

      {/* X-axis title */}
      <text
        className="trend-axis-title"
        x={baseX + plotW / 2}
        y={H - 2}
        textAnchor="middle"
      >
        Year
      </text>
    </svg>
  );
}

// Round a max value up to a clean axis bound (e.g. 4.2M -> 5M).
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

function PartyBar({ party, maxTotal }) {
  const color = PARTY_COLORS[party.partyCode] || PARTY_COLORS.UNKNOWN;
  const pct = maxTotal > 0 ? (party.totalDonations / maxTotal) * 100 : 0;
  return (
    <div className="party-row">
      <span className="party-dot" style={{ background: color }} />
      <span className="party-code">{party.partyCode}</span>
      <div className="bar-track">
        <div
          className="bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="party-amount">
        {party.totalDonations >= 1_000_000
          ? `$${(party.totalDonations / 1_000_000).toFixed(1)}M`
          : `$${(party.totalDonations / 1_000).toFixed(0)}K`}
      </span>
    </div>
  );
}