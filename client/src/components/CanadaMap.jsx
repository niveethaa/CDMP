import { useEffect, useRef, useState } from "react";
import L from "leaflet";

const PARTY_COLORS = {
  LPC: "#d71920",
  CPC: "#1a4782",
  NDP: "#f37021",
  BQ: "#003da5",
  GPC: "#3d9b35",
  PPC: "#6a0dad",
  UNKNOWN: "#64748b",
};

function getDominantParty(partyStats) {
  if (!partyStats || partyStats.length === 0) return null;
  return partyStats.reduce((a, b) =>
    a.totalDonations > b.totalDonations ? a : b
  );
}

function getProvinceStyle(feature, provinceStats, selectedCode) {
  const code = feature.properties.code;
  const stat = provinceStats.find((s) => s.region?.code === code);
  const isSelected = selectedCode === code;

  if (!stat) {
    return {
      fillColor: "#334155",
      fillOpacity: 0.7,
      color: "#1e293b",
      weight: 1.5,
    };
  }

  const dominant = getDominantParty(stat.partyStats);
  const baseColor = dominant
    ? PARTY_COLORS[dominant.partyCode] || PARTY_COLORS.UNKNOWN
    : PARTY_COLORS.UNKNOWN;

  const allTotals = provinceStats.map((s) => s.totals?.totalDonations || 0);
  const max = Math.max(...allTotals, 1);
  const ratio = (stat.totals?.totalDonations || 0) / max;
  const opacity = 0.3 + ratio * 0.55;

  return {
    fillColor: baseColor,
    fillOpacity: isSelected ? 0.95 : opacity,
    color: isSelected ? "#f0c040" : "#1e293b",
    weight: isSelected ? 3 : 1.5,
  };
}

function formatDollars(amount) {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${Number(amount || 0).toFixed(0)}`;
}

export default function CanadaMap({
  provinceStats,
  selectedCode,
  onSelectProvince,
}) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const geoJsonLayer = useRef(null);
  const [geoData, setGeoData] = useState(null);

  // Load GeoJSON once
  useEffect(() => {
    fetch("/data/canada-provinces.json")
      .then((r) => r.json())
      .then(setGeoData)
      .catch((e) => console.error("Failed to load GeoJSON:", e));
  }, []);

  // Init Leaflet map once
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    leafletMap.current = L.map(mapRef.current, {
      center: [62, -96],
      zoom: 3,
      minZoom: 3,
      maxZoom: 7,
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: true,
    });

    // Dark ocean background tile layer
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
      { subdomains: "abcd", maxZoom: 20 }
    ).addTo(leafletMap.current);

    return () => {
      leafletMap.current?.remove();
      leafletMap.current = null;
    };
  }, []);

  // Re-render GeoJSON layer when data or stats or selection changes
  useEffect(() => {
    if (!leafletMap.current || !geoData || provinceStats.length === 0) return;

    if (geoJsonLayer.current) {
      geoJsonLayer.current.remove();
    }

    geoJsonLayer.current = L.geoJSON(geoData, {
      style: (feature) =>
        getProvinceStyle(feature, provinceStats, selectedCode),

      onEachFeature: (feature, layer) => {
        const code = feature.properties.code;
        const name = feature.properties.name;
        const stat = provinceStats.find((s) => s.region?.code === code);
        const total = stat?.totals?.totalDonations;
        const donors = stat?.totals?.donorCount;
        const dominant = getDominantParty(stat?.partyStats);

        // Hover tooltip
        layer.bindTooltip(
          `<div class="map-tooltip">
            <div class="tooltip-name">${name}</div>
            ${total ? `<div class="tooltip-total">${formatDollars(total)}</div>` : ""}
            ${donors ? `<div class="tooltip-sub">${Number(donors).toLocaleString("en-CA")} donors</div>` : ""}
            ${dominant ? `<div class="tooltip-party" style="color:${PARTY_COLORS[dominant.partyCode] || "#aaa"}">${dominant.partyCode} dominant</div>` : ""}
            <div class="tooltip-hint">Click to explore →</div>
          </div>`,
          {
            permanent: false,
            direction: "auto",
            className: "cdmp-tooltip",
          }
        );

        layer.on({
          mouseover(e) {
            if (selectedCode !== code) {
              e.target.setStyle({
                fillOpacity: 0.95,
                weight: 2.5,
                color: "#e2e8f0",
              });
            }
          },
          mouseout(e) {
            geoJsonLayer.current?.resetStyle(e.target);
          },
          click() {
            onSelectProvince(code);
          },
        });
      },
    }).addTo(leafletMap.current);
  }, [geoData, provinceStats, selectedCode, onSelectProvince]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

      {/* Legend */}
      <div className="map-legend">
        <div className="legend-title">Dominant party · Shade = volume</div>
        <div className="legend-items">
          {Object.entries(PARTY_COLORS)
            .filter(([k]) => k !== "UNKNOWN")
            .map(([code, color]) => (
              <div key={code} className="legend-item">
                <span className="legend-dot" style={{ background: color }} />
                <span>{code}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}