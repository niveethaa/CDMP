import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api/config";
import DonationAnalytics from "./DonationAnalytics";

const DONOR_TYPES = [
  { code: "ALL", name: "All Types" },
  { code: "individuals", name: "Individuals" },
  { code: "organizations", name: "Organizations" },
];

const PROVINCES = [
  { code: "ALL", name: "All Provinces" },
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "British Columbia" },
  { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" },
  { code: "NL", name: "Newfoundland and Labrador" },
  { code: "NS", name: "Nova Scotia" },
  { code: "NT", name: "Northwest Territories" },
  { code: "NU", name: "Nunavut" },
  { code: "ON", name: "Ontario" },
  { code: "PE", name: "Prince Edward Island" },
  { code: "QC", name: "Quebec" },
  { code: "SK", name: "Saskatchewan" },
  { code: "YT", name: "Yukon" },
];

const PARTIES = [
  { code: "ALL", name: "All Parties" },
  { code: "LPC", name: "Liberal" },
  { code: "CPC", name: "Conservative" },
  { code: "NDP", name: "NDP" },
  { code: "BQ", name: "Bloc Québécois" },
  { code: "GPC", name: "Green" },
  { code: "PPC", name: "People's" },
];

const YEARS = ["ALL", ...Array.from({ length: 21 }, (_, i) => String(2004 + i))];

export default function Dashboard() {
  const navigate = useNavigate();

  const [donations, setDonations] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [donorType, setDonorType] = useState("ALL");
  const [province, setProvince] = useState("ALL");
  const [party, setParty] = useState("ALL");
  const [year, setYear] = useState("ALL");
  const [riding, setRiding] = useState("");
  const [search, setSearch] = useState("");


  const [appliedFilters, setAppliedFilters] = useState({
    donorType: "ALL",
    province: "ALL",
    party: "ALL",
    year: "ALL",
    riding: "",
    search: "",

  });

  const token = localStorage.getItem("token");

  const fetchDonations = useCallback(async (filters, pageNum) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        donorType: filters.donorType,
        province: filters.province,
        party: filters.party,
        year: filters.year,
        riding: filters.riding,
        search: filters.search,
        page: pageNum,
        limit: 20,
      });

      const res = await fetch(`${API_BASE}/research/donations?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to fetch donations.");

      const data = await res.json();
      setDonations(data.donations);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchAnalytics = useCallback(async (filters) => {
    setAnalyticsLoading(true);
    try {
      const params = new URLSearchParams({
        donorType: filters.donorType,
        province: filters.province,
        party: filters.party,
        year: filters.year,
        riding: filters.riding,
        search: filters.search,
      });

      const res = await fetch(`${API_BASE}/research/analytics?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;

      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error("Failed to fetch analytics:", err.message);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDonations(appliedFilters, page);
    fetchAnalytics(appliedFilters);
  }, [appliedFilters, page, fetchDonations, fetchAnalytics]);

  function handleApplyFilters() {
    setPage(1);
    setAppliedFilters({ donorType, province, party, year, riding, search });
  }

  function handleClearFilters() {
    setDonorType("ALL");
    setProvince("ALL");
    setParty("ALL");
    setYear("ALL");
    setRiding("");
    setSearch("");
    setPage(1);
    setAppliedFilters({
      donorType: "ALL",
      province: "ALL",
      party: "ALL",
      year: "ALL",
      riding: "",
      search: "",
    });
  }

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/");
  }

  async function handleExportCSV() {
    const params = new URLSearchParams({
      donorType: appliedFilters.donorType,
      province: appliedFilters.province,
      party: appliedFilters.party,
      year: appliedFilters.year,
      riding: appliedFilters.riding,
      search: appliedFilters.search,
    });

    const res = await fetch(`${API_BASE}/research/donations/export?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "donations.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatDonorName(donor) {
    if (donor.donorDisplayName) return donor.donorDisplayName;
    const parts = [
      donor.donorFirstName || "",
      donor.donorMiddleName || "",
      donor.donorLastName || "",
    ].filter(Boolean);
    return parts.join(" ") || "Unknown";
  }

  function formatAmount(amount) {
    return "$" + Number(amount || 0).toLocaleString("en-CA");
  }

  function formatDate(date) {
    if (!date) return "—";
    return new Date(date).toISOString().slice(0, 10);
  }

  return (
    <div className="dashboard">
      <div className="sidebar">
        <h3>Filters</h3>

        <label>Donor Type</label>
        <select value={donorType} onChange={(e) => setDonorType(e.target.value)}>
          {DONOR_TYPES.map((d) => (
            <option key={d.code} value={d.code}>{d.name}</option>
          ))}
        </select>

        <label>Province</label>
        <select value={province} onChange={(e) => setProvince(e.target.value)}>
          {PROVINCES.map((p) => (
            <option key={p.code} value={p.code}>{p.name}</option>
          ))}
        </select>

        <label>Party</label>
        <select value={party} onChange={(e) => setParty(e.target.value)}>
          {PARTIES.map((p) => (
            <option key={p.code} value={p.code}>{p.name}</option>
          ))}
        </select>

        <label>Year</label>
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          {YEARS.map((y) => (
            <option key={y} value={y}>{y === "ALL" ? "All Years" : y}</option>
          ))}
        </select>

        <label>Riding</label>
        <input 
          placeholder="Search riding..." value={riding}
          onChange={(e) => setRiding(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
        />

        <button onClick={handleApplyFilters}>Apply Filters</button>
        <button onClick={handleClearFilters}>Clear Filters</button>
        <button onClick={handleExportCSV}>Export CSV</button>
        <button onClick={() => navigate("/account")}>My Account</button>
      </div>

      <div className="table-container" style={{ paddingBottom: "60px" }}>
        <input
          placeholder="Search Donors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
        />

        {loading && <p style={{ color: "#64748b", marginBottom: 12 }}>Loading...</p>}
        {error && <p style={{ color: "#f87171", marginBottom: 12 }}>{error}</p>}

        <table>
          <thead>
            <tr>
              <th>Donor</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Party</th>
              <th>Date</th>
              <th>Postal Code</th>
              <th>Riding</th>
              <th>Province</th>
            </tr>
          </thead>
          <tbody>
            {donations.map((d, i) => {
              const donor = d.donor || {};
              const party = d.party || {};
              const contribution = d.contribution || {};
              const geography = d.geography || {};

              return (
                <tr key={i}>
                  <td>{formatDonorName(donor)}</td>
                  <td>{donor.donorType || "—"}</td>
                  <td>{formatAmount(contribution.amountTotal)}</td>
                  <td>{party.code || "—"}</td>
                  <td>{formatDate(contribution.dateReceived)}</td>
                  <td>{donor.postalCode || "—"}</td>
                  <td>{geography.ridingName || "—"}</td>
                  <td>{geography.provinceCode || "—"}</td>
                </tr>
              );
            })}
            {!loading && donations.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", color: "#64748b" }}>
                  No records found for the current filters. Please try adjusting your search. 
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ position: total === 0 ? "fixed" : "relative", bottom: 0, background: "#131625", display: "flex", gap: 8, padding: "12px 0", width: total === 0 ? "calc(100% - 440px)" : "auto", alignItems: "center" }}>
          <button
            className="filters-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </button>
          <span style={{ color: "#64748b", fontSize: 13 }}>
            Page {page} of {totalPages} · {total.toLocaleString()} records
          </span>
          <button
            className="filters-btn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      </div>
      <div className="activity">
        <h3>Research Activity</h3>
          <p>All queries and exports are logged.</p>
        <hr />
        <h3>Access Status</h3>
        <p>Research Tier Active</p>
        <p style={{ color: "#64748b", fontSize: 13, marginTop: 8 }}>
          {total.toLocaleString()} records match current filters
        </p>
        <button className="map-preview-btn" onClick={() => navigate("/")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
            <line x1="9" y1="3" x2="9" y2="18" />
            <line x1="15" y1="6" x2="15" y2="21" />
          </svg>
          View Public Map
        </button>
        {analyticsLoading ? (
          <p style={{ color: "#64748b", fontSize: 13, marginTop: 16 }}>Loading charts...</p>
        ) : (
          <DonationAnalytics analytics={analytics} />
        )}
        <button onClick={handleLogout} style={{ marginTop: 8, width: "100%", padding: "9px", background: "#1e2235", border: "1px solid #2e3550", color: "#94a3b8", borderRadius: "8px", cursor: "pointer" }}>
          Logout
        </button>
      </div>
    </div>
  );
}
