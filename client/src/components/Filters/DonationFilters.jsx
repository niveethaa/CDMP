import { useState } from "react";
import {
  BOUNDARY_SETS,
  DATA_MAX_YEAR,
  getBoundarySetByCode,
  getDefaultFilters,
  getFiltersForBoundarySet,
} from "../../utils/boundarySets";

const PARTIES = [
  { code: "ALL", name: "All parties" },
  { code: "CPC", name: "Conservative" },
  { code: "LPC", name: "Liberal" },
  { code: "NDP", name: "New Democratic" },
  { code: "BQ", name: "Bloc Québécois" },
  { code: "GPC", name: "Green" },
  { code: "PPC", name: "People's" },
];

const METRIC_MODES = [
  { code: "total", name: "Total $" },
  { code: "per_capita", name: "Per capita" },
];

const MIN_YEAR = 1993;
const MAX_YEAR = DATA_MAX_YEAR;

function isRidingMapMode(viewLevel) {
  return viewLevel === "province" || viewLevel === "riding";
}

export default function DonationFilters({ filters, viewLevel, onApply, onClose }) {
  const initial = { ...getDefaultFilters(), ...filters };
  const [draftFilters, setDraftFilters] = useState(initial);
  const useBoundaryBuckets = isRidingMapMode(viewLevel);

  const years = [];
  for (let y = MIN_YEAR; y <= MAX_YEAR; y += 1) years.push(y);

  function updateDraft(patch) {
    setDraftFilters((current) => ({ ...current, ...patch }));
  }

  function handleBeginningYear(value) {
    const y = Number(value);
    setDraftFilters((current) => ({
      ...current,
      beginningYear: y,
      endingYear: y > current.endingYear ? y : current.endingYear,
      boundarySet: undefined,
    }));
  }

  function handleEndingYear(value) {
    const y = Number(value);
    setDraftFilters((current) => ({
      ...current,
      endingYear: y,
      beginningYear: y < current.beginningYear ? y : current.beginningYear,
      boundarySet: undefined,
    }));
  }

  function handleBoundarySet(value) {
    const selected = getBoundarySetByCode(value);
    if (!selected?.hasGeoJson) return;
    setDraftFilters((current) => getFiltersForBoundarySet(value, current));
  }

  function handleApply() {
    const finalFilters = { ...draftFilters };
    const boundarySet = getBoundarySetByCode(finalFilters.boundarySet);

    if (useBoundaryBuckets && boundarySet) {
      Object.assign(finalFilters, getFiltersForBoundarySet(boundarySet.code, finalFilters));
    }

    onApply(finalFilters);
    onClose();
  }

  function handleReset() {
    const resetFilters = getDefaultFilters();
    setDraftFilters(resetFilters);
    onApply(resetFilters);
    onClose();
  }


  return (
    <div className="filters-popover">
      <div className="filters-header">
        <div>
          <h3 className="filters-title">Filter donations</h3>
          <p className="filters-subtitle">
            {useBoundaryBuckets ? "Riding View Uses Boundary Buckets." : "National View Uses Custom Years."}
          </p>
        </div>
        <button className="filters-close" onClick={onClose} aria-label="Close filters">
          ✕
        </button>
      </div>

      <div className="filters-field">
        <label className="filters-label">Party</label>
        <select
          className="filters-select"
          value={draftFilters.partyCode}
          onChange={(e) => updateDraft({ partyCode: e.target.value })}
        >
          {PARTIES.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="filters-field">
        <label className="filters-label">Metric</label>
        <div className="filters-segmented" role="group" aria-label="Metric mode">
          {METRIC_MODES.map((mode) => (
            <button
              key={mode.code}
              type="button"
              className={
                draftFilters.metricMode === mode.code
                  ? "filters-segment filters-segment--active"
                  : "filters-segment"
              }
              onClick={() => updateDraft({ metricMode: mode.code })}
            >
              {mode.name}
            </button>
          ))}
        </div>
      </div>

      {useBoundaryBuckets ? (
        <div className="filters-field">
          <label className="filters-label">Riding Boundary Map</label>
          <div className="boundary-options" role="radiogroup" aria-label="Riding boundary map">
            {BOUNDARY_SETS.map((set) => {
              const isActive = draftFilters.boundarySet === set.code;
              const isDisabled = !set.hasGeoJson;
              const noDonationData = set.hasDonationData === false;

              return (
                <button
                  key={set.code}
                  type="button"
                  className={[
                    "boundary-option",
                    isActive ? "boundary-option--active" : "",
                    isDisabled ? "boundary-option--disabled" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => handleBoundarySet(set.code)}
                  disabled={isDisabled}
                  role="radio"
                  aria-checked={isActive}
                >
                  <span className="boundary-option-main">{set.label}</span>
                  <span className="boundary-option-sub">
                    {isDisabled ? "Unavailable" : noDonationData ? "No Data Available" : "Available"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="year-grid">
          <div className="filters-field">
            <label className="filters-label">From year</label>
            <select
              className="filters-select"
              value={draftFilters.beginningYear}
              onChange={(e) => handleBeginningYear(e.target.value)}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="filters-field">
            <label className="filters-label">To year</label>
            <select
              className="filters-select"
              value={draftFilters.endingYear}
              onChange={(e) => handleEndingYear(e.target.value)}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="filters-actions">
        <button className="filters-btn" onClick={handleReset}>
          Reset
        </button>
        <button className="filters-btn filters-btn--primary" onClick={handleApply}>
          Apply
        </button>
      </div>
    </div>
  );
}
