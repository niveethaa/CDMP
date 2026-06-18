import { useState, useEffect, useCallback } from "react";
import DonationMap from "../components/Map/DonationMap";
import RegionSummaryPanel from "../components/Summary/RegionSummaryPanel";
import {
  fetchNationalStats,
  fetchAllProvinceStats,
  fetchRegionStats,
} from "../api/regions";
import "../App.css";

const PROVINCE_NAMES = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  NT: "Northwest Territories",
  NU: "Nunavut",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
  YT: "Yukon",
};

export default function HomePage() {
  const [nationalStats, setNationalStats] = useState(null);
  const [provinceStats, setProvinceStats] = useState([]);
  const [selectedStats, setSelectedStats] = useState(null);
  const [selectedCode, setSelectedCode] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [panelLoading, setPanelLoading] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const [national, provinces] = await Promise.all([
          fetchNationalStats(),
          fetchAllProvinceStats(),
        ]);
        setNationalStats(national);
        setProvinceStats(provinces);
        setSelectedStats(national);
      } catch {
        setMapError(true);
      } finally {
        setInitialLoading(false);
      }
    }
    load();
  }, []);

  const handleSelectProvince = useCallback(
    async (code) => {
      if (code === selectedCode) return;
      setSelectedCode(code);
      setPanelLoading(true);
      setSearchQuery("");
      setSearchResults([]);
      try {
        const stats = await fetchRegionStats("province", code);
        setSelectedStats(stats);
      } catch {
        setSelectedStats(null);
      } finally {
        setPanelLoading(false);
      }
    },
    [selectedCode]
  );

  function handleBackToNational() {
    setSelectedCode(null);
    setSelectedStats(nationalStats);
  }

  function handleSearch(e) {
    const q = e.target.value;
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    const matches = Object.entries(PROVINCE_NAMES).filter(
      ([code, name]) =>
        name.toLowerCase().includes(q.toLowerCase()) ||
        code.toLowerCase().includes(q.toLowerCase())
    );
    setSearchResults(matches);
  }

  function handleSearchSelect(code) {
    setSearchQuery("");
    setSearchResults([]);
    handleSelectProvince(code);
  }

  if (initialLoading) {
    return (
      <div className="cdmp-fullscreen">
        <div className="cdmp-spinner" />
        <p>Loading donation map…</p>
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="cdmp-fullscreen cdmp-fullscreen--error">
        <p>⚠️ The donation map is currently unavailable.</p>
        <p>Make sure the server is running on port 5001.</p>
      </div>
    );
  }

  return (
    <div className="cdmp-root">
      <header className="cdmp-nav">
        <div className="nav-left">
          <span className="nav-logo">📍</span>
          <span className="nav-brand">CDMP</span>
          <span className="nav-tagline">Canadian Donations Mapping Platform</span>
        </div>

        <div className="nav-right">
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              type="text"
              placeholder="Search region…"
              value={searchQuery}
              onChange={handleSearch}
              aria-label="Search region"
            />
           {searchQuery.trim() && (
              <ul className="search-dropdown">
                {searchResults.length > 0 ? (
                  searchResults.map(([code, name]) => (
                    <li key={code} onClick={() => handleSearchSelect(code)}>
                      <strong>{code}</strong> — {name}
                    </li>
                  ))
                ) : (
                  <li className="search-noresult">No regions found</li>
                )}
              </ul>
            )}
          </div>

          <button className="nav-btn">Filters</button>
          <button className="nav-btn nav-btn--primary">🔒 Research Login</button>
        </div>
      </header>

      <div className="cdmp-body">
        <div className="map-wrap">
          <DonationMap
            provinceStats={provinceStats}
            selectedCode={selectedCode}
            onSelectProvince={handleSelectProvince}
          />

          {selectedCode && (
            <button className="map-back-btn" onClick={handleBackToNational}>
              🇨🇦 All of Canada
            </button>
          )}
        </div>

        <aside className="side-panel">
          <RegionSummaryPanel
            stats={selectedStats}
            onBack={handleBackToNational}
            loading={panelLoading}
          />
        </aside>
      </div>
    </div>
  );
}