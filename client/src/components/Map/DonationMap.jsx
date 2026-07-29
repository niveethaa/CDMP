import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { PARTY_COLORS } from "../../utils/partyColors";
import { formatDollars } from "../../utils/format";

function getDominantParty(partyStats) {
  if (!partyStats || partyStats.length === 0) return null;
  return partyStats.reduce((a, b) =>
    (a.totalDonations || 0) > (b.totalDonations || 0) ? a : b,
  );
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isRidingMapView(viewLevel) {
  return viewLevel === "province" || viewLevel === "riding";
}

function getFeatureInfo(feature, viewLevel) {
  const properties = feature.properties || {};

  if (isRidingMapView(viewLevel)) {
    const code = String(properties.code || properties.fednum || "").padStart(5, "0");

    return {
      code,
      name: properties.name || "Unnamed riding",
      provinceCode: properties.provinceCode || properties.provcode || code.slice(0, 2),
      population: Number(properties.population || properties.decpopcnt || 0),
      boundarySet: properties.boundarySet || "",
    };
  }

  return {
    code: properties.code,
    name: properties.name,
    provinceCode: properties.code,
    population: 0,
    boundarySet: "province_2024",
  };
}

function getRegionStyle({ feature, viewLevel, stats, selectedCode, metricMode }) {
  const info = getFeatureInfo(feature, viewLevel);
  const stat = stats.find((s) => s.region?.code === info.code);
  const isSelected = selectedCode === info.code;

  if (!stat) {
    return {
      fillColor: isRidingMapView(viewLevel) ? "#243044" : "#334155",
      fillOpacity: isSelected ? 0.78 : isRidingMapView(viewLevel) ? 0.46 : 0.65,
      color: isSelected ? "#facc15" : "#1e293b",
      weight: isSelected ? 3 : 1.15,
      opacity: 1,
      dashArray: isRidingMapView(viewLevel) ? "2" : null,
    };
  }

  const dominant = getDominantParty(stat.partyStats);
  const baseColor = dominant
    ? PARTY_COLORS[dominant.partyCode] || PARTY_COLORS.UNKNOWN
    : PARTY_COLORS.UNKNOWN;

  const metricKey = metricMode === "per_capita" ? "perCapitaAmount" : "totalDonations";
  const max = stats.reduce((m, s) => Math.max(m, s.totals?.[metricKey] || 0), 1);
  const ratio = (stat.totals?.[metricKey] || 0) / max;
  const opacity = 0.32 + ratio * 0.56;

  return {
    fillColor: baseColor,
    fillOpacity: isSelected ? 0.96 : opacity,
    color: isSelected ? "#facc15" : "#142033",
    weight: isSelected ? 3.6 : isRidingMapView(viewLevel) ? 1.05 : 1.45,
    opacity: 1,
    dashArray: null,
  };
}

function buildTooltip({ info, stat, viewLevel, metricMode }) {
  const total = stat?.totals?.totalDonations || 0;
  const perCapita = stat?.totals?.perCapitaAmount || 0;
  const donors = stat?.totals?.donorCount || 0;
  const dominant = getDominantParty(stat?.partyStats);
  const hasStats = Boolean(stat);

  return `<div class="map-tooltip">
    <div class="tooltip-name">${escapeHtml(info.name)}</div>
    ${hasStats ? `<div class="tooltip-total">${metricMode === "per_capita" ? `${formatDollars(perCapita)} per capita` : formatDollars(total)}</div>` : ""}
    ${donors ? `<div class="tooltip-sub">${Number(donors).toLocaleString("en-CA")} donors</div>` : ""}
    ${dominant ? `<div class="tooltip-party" style="color:${PARTY_COLORS[dominant.partyCode] || "#aaa"}">${escapeHtml(dominant.partyCode)} dominant</div>` : ""}
    ${!hasStats && isRidingMapView(viewLevel) ? `<div class="tooltip-sub">No donation summary loaded yet</div>` : ""}
    <div class="tooltip-hint">${isRidingMapView(viewLevel) ? "Click for riding summary" : "Click to view ridings"}</div>
  </div>`;
}

export default function DonationMap({
  provinceStats,
  ridingStats,
  viewLevel,
  selectedProvinceCode,
  selectedRidingCode,
  boundarySetCode,
  boundarySetLabel,
  metricMode,
  onSelectProvince,
  onSelectRiding,
}) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const geoJsonLayer = useRef(null);
  const [provinceGeoData, setProvinceGeoData] = useState(null);
  const [ridingGeoData, setRidingGeoData] = useState(null);
  const [geoError, setGeoError] = useState(false);
  const [ridingGeoError, setRidingGeoError] = useState(false);
  const [renderError, setRenderError] = useState(false);

  const isRidingView = isRidingMapView(viewLevel) && selectedProvinceCode;
  const activeGeoData = isRidingView ? ridingGeoData : provinceGeoData;
  const activeStats = isRidingView ? ridingStats : provinceStats;
  const activeSelectedCode = isRidingView ? selectedRidingCode : selectedProvinceCode;

  useEffect(() => {
    let cancelled = false;

    fetch("/data/canada-provinces.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setProvinceGeoData(data);
      })
      .catch((e) => {
        console.error("Failed to load province GeoJSON:", e);
        if (!cancelled) setGeoError(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isRidingView || !boundarySetCode) {
      // Reset the riding layer when returning to the national map.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRidingGeoData(null);
      setRidingGeoError(false);
      return;
    }

    let cancelled = false;
    setRidingGeoData(null);
    setRidingGeoError(false);

    fetch(`/data/ridings/${boundarySetCode}/${selectedProvinceCode}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setRidingGeoData(data);
      })
      .catch((e) => {
        console.error("Failed to load riding GeoJSON:", e);
        if (!cancelled) setRidingGeoError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [boundarySetCode, isRidingView, selectedProvinceCode]);

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    leafletMap.current = L.map(mapRef.current, {
      center: [62, -96],
      zoom: 3,
      minZoom: 3,
      maxZoom: 9,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
    });

    L.control.zoom({ position: "bottomleft" }).addTo(leafletMap.current);

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
      { subdomains: "abcd", maxZoom: 20 },
    ).addTo(leafletMap.current);

    return () => {
      leafletMap.current?.remove();
      leafletMap.current = null;
    };
  }, []);

  const statsByCode = useMemo(() => {
    const map = new Map();
    activeStats.forEach((stat) => map.set(stat.region?.code, stat));
    return map;
  }, [activeStats]);

  useEffect(() => {
    if (!leafletMap.current || !activeGeoData) return;

    setRenderError(false);

    if (geoJsonLayer.current) {
      geoJsonLayer.current.remove();
      geoJsonLayer.current = null;
    }

    try {
      geoJsonLayer.current = L.geoJSON(activeGeoData, {
        style: (feature) => {
          try {
            return getRegionStyle({
              feature,
              viewLevel,
              stats: activeStats,
              selectedCode: activeSelectedCode,
              metricMode,
            });
          } catch (err) {
            console.error("Failed to style feature:", err);
            return { fillColor: "#334155", fillOpacity: 0.4, color: "#1e293b", weight: 1 };
          }
        },

        onEachFeature: (feature, layer) => {
          try {
            const info = getFeatureInfo(feature, viewLevel);
            const stat = statsByCode.get(info.code);

            layer.bindTooltip(buildTooltip({ info, stat, viewLevel, metricMode }), {
              permanent: false,
              direction: "auto",
              className: "cdmp-tooltip",
            });

            layer.on({
              mouseover(e) {
                try {
                  e.target.bringToFront?.();
                  if (activeSelectedCode !== info.code) {
                    e.target.setStyle({
                      fillOpacity: 0.97,
                      weight: isRidingMapView(viewLevel) ? 2.4 : 2.8,
                      color: "#e2e8f0",
                    });
                  }
                } catch (err) {
                  console.error("Hover handler failed:", err);
                }
              },
              mouseout(e) {
                try {
                  geoJsonLayer.current?.resetStyle(e.target);
                } catch (err) {
                  console.error("Mouseout handler failed:", err);
                }
              },
              click() {
                // Leaflet DOM handlers are outside React's error boundary,
                // so any failure here must be caught locally to avoid an
                // uncaught exception that leaves the UI in a broken state.
                try {
                  if (isRidingMapView(viewLevel)) {
                    onSelectRiding?.(info);
                  } else {
                    onSelectProvince?.(info.code);
                  }
                } catch (err) {
                  console.error("Failed to handle region click:", err);
                  setRenderError(true);
                }
              },
            });
          } catch (err) {
            console.error("Failed to initialize a map feature:", err);
          }
        },
      }).addTo(leafletMap.current);

      const bounds = geoJsonLayer.current.getBounds();
      if (bounds.isValid()) {
        leafletMap.current.fitBounds(bounds, {
          paddingTopLeft: isRidingView ? [24, 66] : [18, 18],
          paddingBottomRight: [28, 28],
          maxZoom: isRidingView ? 7 : 4,
        });
      }
    } catch (err) {
      console.error("Failed to render map layer:", err);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRenderError(true);
    }
  }, [
    activeGeoData,
    activeSelectedCode,
    activeStats,
    isRidingView,
    metricMode,
    onSelectProvince,
    onSelectRiding,
    statsByCode,
    viewLevel,
  ]);

  const isLoadingMap = !provinceGeoData || (isRidingView && !ridingGeoData && !ridingGeoError);

  return (
    <div className="map-shell">
      <div ref={mapRef} className="leaflet-map-root" />

      {isLoadingMap && !geoError && (
        <div className="map-overlay">
          <div className="map-overlay-spinner" />
          <p>{isRidingView ? "Loading riding boundaries…" : "Loading map…"}</p>
        </div>
      )}

      {geoError && (
        <div className="map-overlay map-overlay--error">
          <p>We couldn't load the national map right now.</p>
          <p className="map-overlay-sub">Please try refreshing the page.</p>
        </div>
      )}

      {renderError && !geoError && (
        <div className="map-overlay map-overlay--warning">
          <p>We hit a problem drawing this part of the map.</p>
          <p className="map-overlay-sub">
            Try selecting a different region, or use “Back to National View”.
          </p>
        </div>
      )}

      {ridingGeoError && (
        <div className="map-overlay map-overlay--warning">
          <p>Riding boundaries are not available for this bucket yet.</p>
          <p className="map-overlay-sub">
            Add the GeoJSON for {boundarySetLabel || boundarySetCode} or choose another riding map.
          </p>
        </div>
      )}

      {activeGeoData && !geoError && !ridingGeoError && (
        <div className="map-legend">
          <div className="legend-title">
            Dominant party · Shade = {metricMode === "per_capita" ? "per capita" : "volume"}
          </div>
          <div className="legend-items">
            {Object.entries(PARTY_COLORS)
              .filter(([code]) => code !== "UNKNOWN")
              .map(([code, color]) => (
                <div key={code} className="legend-item">
                  <span className="legend-dot" style={{ background: color }} />
                  <span>{code}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
