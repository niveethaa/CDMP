import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import DonationMap from "../components/Map/DonationMap";
import RegionSummaryPanel from "../components/Summary/RegionSummaryPanel";
import DonationFilters from "../components/Filters/DonationFilters";
import ErrorBoundary from "../components/ErrorBoundaryComponent";
import AskDataPanel from "../components/AskData/AskDataPanel";

import {
  fetchNationalStats,
  fetchAllProvinceStats,
  fetchRegionStats,
  fetchRidingStatsByProvince,
} from "../api/regions";
import {
  DATA_MIN_YEAR,
  DATA_MAX_YEAR,
  getBoundarySetForFilters,
  getDefaultFilters,
} from "../utils/boundarySets";
import { PARTY_LABELS } from "../utils/parties";
import { findRidingByIdentifier } from "../utils/askDataFilters";
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

function getBoundaryEndingYear(boundarySet) {
  if (!boundarySet) return DATA_MAX_YEAR;
  if (boundarySet.hasDonationData === false) return boundarySet.validFromYear;
  return Math.min(boundarySet.validToYear, DATA_MAX_YEAR);
}

function buildActiveFilterChips({ filters, viewLevel, selectedProvinceCode, activeBoundarySet }) {
  const partyCode = filters.partyCode || "ALL";
  const metricLabel = filters.metricMode === "donation_count" ? "Donation Count" : "Total $";
  const provinceName = selectedProvinceCode
    ? PROVINCE_NAMES[selectedProvinceCode] || selectedProvinceCode
    : null;
  const locationLabel = viewLevel === "national" ? "Canada" : `${provinceName} Ridings`;
  const yearLabel = viewLevel === "national"
    ? `${filters.beginningYear}–${filters.endingYear}`
    : activeBoundarySet
      ? `${activeBoundarySet.validFromYear}–${getBoundaryEndingYear(activeBoundarySet)}`
      : `${filters.beginningYear}–${filters.endingYear}`;

  const chips = [
    locationLabel,
    PARTY_LABELS[partyCode] || partyCode,
    yearLabel,
    metricLabel,
  ];

  if (viewLevel !== "national" && activeBoundarySet?.shortLabel) {
    chips.push(activeBoundarySet.shortLabel);
  }

  return chips;
}

function createEmptyTotals(population = 0) {
  return {
    totalDonations: 0,
    donationCount: 0,
    donorCount: 0,
    averageDonation: 0,
    perCapitaAmount: 0,
    population: Number(population || 0),
  };
}

function buildEmptyRegionStats(region, boundarySetLabel, filters, message) {
  return {
    region,
    filters: {
      beginningYear: filters.beginningYear,
      endingYear: filters.endingYear,
      partyCode: filters.partyCode || "ALL",
      metricMode: filters.metricMode || "total",
    },
    totals: createEmptyTotals(region?.population || 0),
    partyStats: [],
    donationsTrend: [],
    privacy: {
      isSuppressed: false,
      suppressionThreshold: 5,
      suppressionReason: "",
    },
    _boundarySetLabel: boundarySetLabel,
    _noDataMessage: message,
  };
}

function buildRidingRegionFromProperties(properties = {}, filters = {}) {
  const code = String(properties.code || properties.fednum || "").padStart(5, "0");

  return {
    level: "riding",
    code,
    name: properties.name || "Unnamed Riding",
    provinceCode: properties.provinceCode,
    provinceName: properties.provinceName,
    boundarySet: properties.boundarySet || filters.boundarySet,
    population: Number(properties.population || properties.decpopcnt || 0),
  };
}

function buildFallbackMessage(activeBoundarySet) {
  if (activeBoundarySet?.hasDonationData === false) {
    return activeBoundarySet.noDataMessage || "Currently there is no donation data available for this time frame.";
  }

  return "No donation summary has been built for this selection yet. Run the riding matching and timeline aggregation scripts to populate this panel.";
}

function buildFilterQuery(filters, activeBoundarySet, includeBoundarySet = false) {
  const query = {
    partyCode: filters.partyCode || "ALL",
    beginningYear: filters.beginningYear,
    endingYear: filters.endingYear,
    metricMode: filters.metricMode || "total",
  };

  if (!includeBoundarySet && activeBoundarySet?.hasDonationData === false) {
    query.beginningYear = DATA_MIN_YEAR;
    query.endingYear = DATA_MAX_YEAR;
  }

  if (includeBoundarySet && activeBoundarySet?.code) {
    query.boundarySet = activeBoundarySet.code;
    query.beginningYear = activeBoundarySet.validFromYear;
    query.endingYear = getBoundaryEndingYear(activeBoundarySet);
  }

  return query;
}

function makeProvinceSearchResults(query) {
  const q = query.toLowerCase();

  return Object.entries(PROVINCE_NAMES)
    .filter(
      ([code, name]) =>
        name.toLowerCase().includes(q) || code.toLowerCase().includes(q),
    )
    .map(([code, name]) => ({
      type: "province",
      code,
      name,
      label: `${code} — ${name}`,
    }))
    .slice(0, 12);
}

function makeRidingSearchResults(query, ridingStats) {
  const q = query.toLowerCase();

  return (ridingStats || [])
    .map((stat) => ({
      type: "riding",
      code: stat.region?.code,
      name: stat.region?.name,
      region: stat.region,
      label: `${stat.region?.code} — ${stat.region?.name}`,
    }))
    .filter(
      (item) =>
        item.code?.toLowerCase().includes(q) ||
        item.name?.toLowerCase().includes(q),
    )
    .slice(0, 12);
}

async function loadRidingMetadataForProvince(provinceCode, activeBoundarySet, filters) {
  if (!provinceCode || !activeBoundarySet?.code) return [];

  const response = await fetch(
    `/data/ridings/${activeBoundarySet.code}/${provinceCode}.json`,
  );

  if (!response.ok) {
    throw new Error(`Unable to load ${activeBoundarySet.code}/${provinceCode}.json`);
  }

  const featureCollection = await response.json();
  const message = buildFallbackMessage(activeBoundarySet);

  return (featureCollection.features || []).map((feature) => {
    const region = buildRidingRegionFromProperties(feature.properties, filters);
    return buildEmptyRegionStats(region, activeBoundarySet.label, filters, message);
  });
}

function mergeRidingStatsWithMetadata(metadataStats, apiStats) {
  const byCode = new Map();

  for (const stat of metadataStats || []) {
    if (stat.region?.code) byCode.set(stat.region.code, stat);
  }

  for (const stat of apiStats || []) {
    if (stat.region?.code) byCode.set(stat.region.code, stat);
  }

  return [...byCode.values()].sort((a, b) =>
    String(a.region?.name || "").localeCompare(String(b.region?.name || "")),
  );
}

function buildProvinceFallbackStats(provinceCode, activeBoundarySet, filters) {
  const name = PROVINCE_NAMES[provinceCode] || provinceCode;
  return buildEmptyRegionStats(
    {
      level: "province",
      code: provinceCode,
      name,
      provinceCode,
      provinceName: name,
      boundarySet: activeBoundarySet?.code,
    },
    activeBoundarySet?.label,
    filters,
    buildFallbackMessage(activeBoundarySet),
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [nationalStats, setNationalStats] = useState(null);
  const [provinceStats, setProvinceStats] = useState([]);
  const [ridingStats, setRidingStats] = useState([]);
  const [selectedStats, setSelectedStats] = useState(null);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState(null);
  const [selectedRidingCode, setSelectedRidingCode] = useState(null);
  const [selectedRidingInfo, setSelectedRidingInfo] = useState(null);
  const [pendingRidingSelection, setPendingRidingSelection] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [panelLoading, setPanelLoading] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [filters, setFilters] = useState(() => getDefaultFilters());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const previousBoundarySet = useRef(filters.boundarySet);

  const activeBoundarySet = useMemo(
    () => getBoundarySetForFilters(filters, { requireRidingData: true }),
    [filters],
  );

  const viewLevel = selectedRidingCode
    ? "riding"
    : selectedProvinceCode
      ? "province"
      : "national";

  const overviewQuery = useMemo(
    () => buildFilterQuery(filters, activeBoundarySet, false),
    [activeBoundarySet, filters],
  );

  const ridingQuery = useMemo(
    () => buildFilterQuery(filters, activeBoundarySet, true),
    [activeBoundarySet, filters],
  );

  const selectedProvinceName = selectedProvinceCode
    ? PROVINCE_NAMES[selectedProvinceCode] || selectedProvinceCode
    : "";

  const boundaryHasNoDonationData = activeBoundarySet?.hasDonationData === false;
  const boundaryNoDataMessage = boundaryHasNoDonationData
    ? buildFallbackMessage(activeBoundarySet)
    : "";

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      try {
        setMapError(false);
        const [national, provinces] = await Promise.all([
          fetchNationalStats(overviewQuery),
          fetchAllProvinceStats(overviewQuery),
        ]);

        if (cancelled) return;

        setNationalStats(national);
        setProvinceStats(provinces);

        if (!selectedProvinceCode && !selectedRidingCode) {
          setSelectedStats(national);
        }
      } catch (error) {
        console.error("Failed to load national/province stats:", error);
        if (!cancelled) setMapError(true);
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    }

    loadOverview();

    return () => {
      cancelled = true;
    };
  }, [overviewQuery, selectedProvinceCode, selectedRidingCode]);

  useEffect(() => {
    if (previousBoundarySet.current === filters.boundarySet) return;

    previousBoundarySet.current = filters.boundarySet;
    setSelectedRidingCode(null);
    setSelectedRidingInfo(null);
  }, [filters.boundarySet]);

  useEffect(() => {
    if (!selectedProvinceCode) return;

    let cancelled = false;

    async function loadProvinceView() {
      setPanelLoading(true);
      setSearchQuery("");
      setSearchResults([]);

      try {
        const [metadataResult, provinceResult, ridingsResult] = await Promise.allSettled([
          loadRidingMetadataForProvince(selectedProvinceCode, activeBoundarySet, filters),
          boundaryHasNoDonationData
            ? Promise.resolve(null)
            : fetchRegionStats("province", selectedProvinceCode, ridingQuery),
          boundaryHasNoDonationData
            ? Promise.resolve([])
            : fetchRidingStatsByProvince(selectedProvinceCode, ridingQuery),
        ]);

        if (cancelled) return;

        const metadataStats = metadataResult.status === "fulfilled" ? metadataResult.value : [];
        const apiRidingStats = ridingsResult.status === "fulfilled" ? ridingsResult.value : [];
        const mergedRidingStats = mergeRidingStatsWithMetadata(metadataStats, apiRidingStats);

        setRidingStats(mergedRidingStats);

        if (!selectedRidingCode) {
          if (provinceResult.status === "fulfilled" && provinceResult.value) {
            setSelectedStats({
              ...provinceResult.value,
              _boundarySetLabel: activeBoundarySet?.label,
              _noDataMessage: boundaryNoDataMessage || provinceResult.value._noDataMessage,
            });
          } else {
            setSelectedStats(
              buildProvinceFallbackStats(selectedProvinceCode, activeBoundarySet, filters),
            );
          }
          return;
        }

        const fallbackRiding =
          selectedRidingInfo ||
          mergedRidingStats.find((stat) => stat.region?.code === selectedRidingCode)?.region;

        if (boundaryHasNoDonationData) {
          setSelectedStats(
            buildEmptyRegionStats(
              fallbackRiding,
              activeBoundarySet?.label,
              filters,
              boundaryNoDataMessage,
            ),
          );
          return;
        }

        try {
          const riding = await fetchRegionStats("riding", selectedRidingCode, ridingQuery);

          if (!cancelled) {
            setSelectedStats({
              ...riding,
              _boundarySetLabel: activeBoundarySet?.label,
            });
          }
        } catch (error) {
          if (!cancelled && fallbackRiding) {
            setSelectedStats(
              buildEmptyRegionStats(
                fallbackRiding,
                activeBoundarySet?.label,
                filters,
                buildFallbackMessage(activeBoundarySet),
              ),
            );
          } else if (!cancelled) {
            console.warn("No riding stats found and no fallback metadata available.", error);
            setSelectedStats(null);
          }
        }
      } catch (error) {
        console.error("Failed to load province/riding data:", error);
        if (!cancelled) {
          setRidingStats([]);
          setSelectedStats(
            buildProvinceFallbackStats(selectedProvinceCode, activeBoundarySet, filters),
          );
        }
      } finally {
        if (!cancelled) setPanelLoading(false);
      }
    }

    loadProvinceView();

    return () => {
      cancelled = true;
    };
  }, [
    activeBoundarySet,
    boundaryHasNoDonationData,
    boundaryNoDataMessage,
    filters,
    ridingQuery,
    selectedProvinceCode,
    selectedRidingCode,
    selectedRidingInfo,
  ]);

  const handleSelectProvince = useCallback((code) => {
    setPendingRidingSelection(null);
    setSelectedProvinceCode(code);
    setSelectedRidingCode(null);
    setSelectedRidingInfo(null);
    setRidingStats([]);
    setSearchQuery("");
    setSearchResults([]);
    setFiltersOpen(false);
  }, []);

  const handleSelectRiding = useCallback((riding) => {
    if (!riding?.code) return;

    const enrichedRiding = {
      level: "riding",
      provinceCode: selectedProvinceCode || riding.provinceCode,
      provinceName:
        PROVINCE_NAMES[selectedProvinceCode || riding.provinceCode] ||
        riding.provinceName,
      boundarySet: activeBoundarySet?.code || riding.boundarySet,
      ...riding,
    };

    setPendingRidingSelection(null);
    setSelectedRidingCode(enrichedRiding.code);
    setSelectedRidingInfo(enrichedRiding);
    setSearchQuery("");
    setSearchResults([]);
  }, [activeBoundarySet?.code, selectedProvinceCode]);

  useEffect(() => {
    if (!pendingRidingSelection || panelLoading) return;
    if (pendingRidingSelection.provinceCode !== selectedProvinceCode) return;

    const matched = findRidingByIdentifier(
      ridingStats,
      pendingRidingSelection.identifier,
    );

    if (matched?.region) {
      const selectionTimer = window.setTimeout(() => {
        handleSelectRiding(matched.region);
      }, 0);

      return () => window.clearTimeout(selectionTimer);
    }

    return undefined;
  }, [
    handleSelectRiding,
    panelLoading,
    pendingRidingSelection,
    ridingStats,
    selectedProvinceCode,
  ]);

  function handleBackToNational() {
    setPendingRidingSelection(null);
    setSelectedProvinceCode(null);
    setSelectedRidingCode(null);
    setSelectedRidingInfo(null);
    setRidingStats([]);
    setSearchQuery("");
    setSearchResults([]);

    if (activeBoundarySet?.hasDonationData === false) {
      setFilters(getDefaultFilters());
      return;
    }

    setSelectedStats(nationalStats);
  }

  function handlePanelBack() {
    if (selectedRidingCode && selectedProvinceCode) {
      setSelectedRidingCode(null);
      setSelectedRidingInfo(null);
      return;
    }

    handleBackToNational();
  }

  function handleSearch(e) {
    const q = e.target.value;
    setSearchQuery(q);

    if (!q.trim()) {
      setSearchResults([]);
      return;
    }

    const matches = viewLevel === "national"
      ? makeProvinceSearchResults(q)
      : makeRidingSearchResults(q, ridingStats);

    setSearchResults(matches);
  }

  function handleSearchSelect(result) {
    setSearchQuery("");
    setSearchResults([]);

    if (result.type === "province") {
      handleSelectProvince(result.code);
      return;
    }

    if (result.type === "riding") {
      handleSelectRiding(result.region);
    }
  }

  function handleApplyFilters(nextFilters) {
    setFilters(nextFilters);
    setFiltersOpen(false);
  }

  const searchPlaceholder = viewLevel === "national"
    ? "Search Province or Territory…"
    : `Search Ridings in ${selectedProvinceName || selectedProvinceCode}…`;

  const activeFilterChips = useMemo(
    () => buildActiveFilterChips({ filters, viewLevel, selectedProvinceCode, activeBoundarySet }),
    [activeBoundarySet, filters, selectedProvinceCode, viewLevel],
  );

  const askCurrentFilters = useMemo(() => {
    const visiblePeriod = viewLevel === "national" ? overviewQuery : ridingQuery;
    const ridingName = selectedStats?.region?.name
      || selectedRidingInfo?.name
      || selectedRidingCode;

    return {
      ...visiblePeriod,
      regionLevel: viewLevel,
      regionCode: viewLevel === "national"
        ? "CA"
        : viewLevel === "province"
          ? selectedProvinceCode
          : ridingName,
      provinceCode: selectedProvinceCode || undefined,
      boundarySet: viewLevel === "national" ? undefined : activeBoundarySet?.code,
    };
  }, [
    activeBoundarySet?.code,
    overviewQuery,
    ridingQuery,
    selectedProvinceCode,
    selectedRidingCode,
    selectedRidingInfo?.name,
    selectedStats?.region?.name,
    viewLevel,
  ]);

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
        <p>The donation map is currently unavailable.</p>
        <p>Please try refreshing the page, or check back in a little while.</p>
      </div>
    );
  }

  return (
    <div className="cdmp-root">
      <header className="cdmp-nav">
        <div className="nav-left">
          <span className="nav-brand">CDMP</span>
          <span className="nav-tagline">Canadian Donations Mapping Platform</span>
        </div>

        <div className="nav-right">
          <div className="search-wrap">
            <input
              className="search-input"
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={handleSearch}
              aria-label="Search region"
            />
            {searchQuery.trim() && (
              <ul className="search-dropdown">
                {searchResults.length > 0 ? (
                  searchResults.map((result) => (
                    <li
                      key={`${result.type}-${result.code}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSearchSelect(result)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSearchSelect(result);
                        }
                      }}
                    >
                      {result.label}
                    </li>
                  ))
                ) : (
                  <li className="search-noresult">
                    {viewLevel === "national" ? "No Regions Found" : "No Ridings Found"}
                  </li>
                )}
              </ul>
            )}
          </div>

          <div className="filters-wrap">
            <button
              className="nav-btn"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
            >
              Filters
            </button>
            {filtersOpen && (
              <DonationFilters
                filters={filters}
                viewLevel={viewLevel}
                onApply={handleApplyFilters}
                onClose={() => setFiltersOpen(false)}
              />
            )}
          </div>
            {localStorage.getItem("token") ? (
            <>
              <button className="nav-btn nav-btn--primary" onClick={() => navigate("/dashboard")}>
                Back to Dashboard
              </button>
              <button className="nav-btn" onClick={() => {
                localStorage.removeItem("token");
                navigate("/");
              }}>
                Logout
              </button>
            </>
            ) : (
              <button className="nav-btn nav-btn--primary" onClick={() => navigate("/login")}>
                Research Login
              </button>
            )}
          </div>
      </header>

      <div className="cdmp-body">
        <div className="map-wrap">
          <ErrorBoundary label="the map" onReset={handleBackToNational}>
            <DonationMap
              provinceStats={provinceStats}
              ridingStats={ridingStats}
              viewLevel={viewLevel}
              selectedProvinceCode={selectedProvinceCode}
              selectedRidingCode={selectedRidingCode}
              metricMode={filters.metricMode}
              boundarySetCode={activeBoundarySet?.code}
              boundarySetLabel={activeBoundarySet?.label}
              onSelectProvince={handleSelectProvince}
              onSelectRiding={handleSelectRiding}
            />
          </ErrorBoundary>

          <div className="active-filters-bar" aria-label="Active map filters">
            {activeFilterChips.map((chip) => (
              <span key={chip} className="active-filter-chip">
                {chip}
              </span>
            ))}
          </div>

          {selectedProvinceCode && (
            <button className="map-back-btn" onClick={handleBackToNational}>
              ← Back to National View
            </button>
          )}

          {selectedProvinceCode && boundaryNoDataMessage && (
            <div className="map-no-data-banner" role="status">
              {boundaryNoDataMessage}
            </div>
          )}
        </div>

        <aside className="side-panel">
          <ErrorBoundary label="the region summary" compact onReset={handlePanelBack}>
            <RegionSummaryPanel
              stats={selectedStats}
              onBack={handlePanelBack}
              loading={panelLoading}
            />
          </ErrorBoundary>
          <AskDataPanel
            key={`${viewLevel}:${selectedProvinceCode || "CA"}:${selectedRidingCode || ""}`}
            currentFilters={askCurrentFilters}
            onApplyFilters={(mapFilters, provinceCode, ridingCode) => {
              handleApplyFilters(mapFilters);
              if (provinceCode) {
                handleSelectProvince(provinceCode);
              }
              if (ridingCode && provinceCode) {
                setPendingRidingSelection({
                  identifier: ridingCode,
                  provinceCode,
                });
              }
            }}
            onClearFilters={() => {
              handleBackToNational();
              handleApplyFilters(getDefaultFilters());
            }}
          />
        </aside>
      </div>
    </div>
  );
}
