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

export default function RegionPanel({ stats, onBack, loading }) {
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
        <div className="panel-empty-icon">📍</div>
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
            ← Canada
          </button>
        )}
      </div>

      {privacy?.isSuppressed && (
        <div className="suppression-notice">
          ⚠️ {privacy.suppressionReason}
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
        <div className="trend-chart">
          {donationsTrend?.map((t) => (
            <div
              key={t.year}
              className="trend-col"
              title={`${t.year}: ${formatDollars(t.totalDonations)}`}
            >
              <div
                className="trend-bar"
                style={{ height: `${(t.totalDonations / maxTrend) * 100}%` }}
              />
              <span className="trend-label">
                {t.year % 4 === 0 ? String(t.year).slice(2) : ""}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
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