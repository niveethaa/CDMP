function formatCount(n) {
  return Number(n || 0).toLocaleString("en-CA");
}

function formatBucketLabel(id) {
  if (id === "10000+") return "$10K+";
  if (id === 0) return "$0-50";
  if (id === 50) return "$50-100";
  if (id === 100) return "$100-250";
  if (id === 250) return "$250-500";
  if (id === 500) return "$500-1K";
  if (id === 1000) return "$1K-5K";
  if (id === 5000) return "$5K-10K";
  return `$${id}+`;
}

function TopRidingsChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="trend-empty">No riding data available.</div>;
  }

  const maxCount = Math.max(...data.map((d) => d.donationCount || 0), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
      {data.map((d) => {
        const pct = (d.donationCount / maxCount) * 100;
        const name = d._id || "Unknown";
        const shortName = name.length > 22 ? name.slice(0, 22) + "…" : name;

        return (
          <div key={name}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ color: "#94a3b8", fontSize: 11 }}>{shortName}</span>
              <span style={{ color: "#94a3b8", fontSize: 11 }}>{formatCount(d.donationCount)}</span>
            </div>
            <div style={{ background: "#1e2235", borderRadius: 4, height: 10 }}>
              <div style={{ width: `${pct}%`, background: "#4361ee", borderRadius: 4, height: "100%" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AmountDistributionChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="trend-empty">No amount distribution data available.</div>;
  }

  const maxCount = Math.max(...data.map((d) => d.count || 0), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
      {data.map((d) => {
        const pct = (d.count / maxCount) * 100;

        return (
          <div key={String(d._id)}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ color: "#94a3b8", fontSize: 11 }}>{formatBucketLabel(d._id)}</span>
              <span style={{ color: "#94a3b8", fontSize: 11 }}>{formatCount(d.count)} donors</span>
            </div>
            <div style={{ background: "#1e2235", borderRadius: 4, height: 10 }}>
              <div style={{ width: `${pct}%`, background: "#818cf8", borderRadius: 4, height: "100%" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DonationAnalytics({ analytics }) {
  if (!analytics) return null;

  const { topRidings, amountDistribution } = analytics;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          Top 5 Ridings by Donation Count
        </p>
        <TopRidingsChart data={topRidings} />
      </div>

      <div>
        <p style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          Donation Concentration 
        </p>
        <AmountDistributionChart data={amountDistribution} />
      </div>
    </div>
  );
}