import { useState } from "react";
import {
  BOUNDARY_SETS,
  DATA_MIN_YEAR,
  DATA_MAX_YEAR,
  getBoundarySetByCode,
  getDefaultFilters,
  getFiltersForBoundarySet,
  isBoundarySetAvailableForRiding,
} from "../../utils/boundarySets";
import { PARTIES } from "../../utils/parties";

const METRIC_MODES = [
  { code: "total", name: "Total $" },
  { code: "donation_count", name: "Donation count" },
];

const MIN_YEAR = DATA_MIN_YEAR;
const MAX_YEAR = DATA_MAX_YEAR;

function isRidingMapMode(viewLevel) {
  return viewLevel === "province" || viewLevel === "riding";
}

export default function DonationFilters({ filters, viewLevel, onApply, onClose }) {
  const useBoundaryBuckets = isRidingMapMode(viewLevel);
  const initial = useBoundaryBuckets
    ? getFiltersForBoundarySet(filters.boundarySet, { ...getDefaultFilters(), ...filters })
    : { ...getDefaultFilters(), ...filters };
  const [draftFilters, setDraftFilters] = useState(initial);

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
    if (!isBoundarySetAvailableForRiding(selected)) return;
    setDraftFilters((current) => getFiltersForBoundarySet(value, current));
  }

  function handleApply() {
    const finalFilters = { ...draftFilters };
    const boundarySet = getBoundarySetByCode(finalFilters.boundarySet);

    if (useBoundaryBuckets) {
      const boundarySetCode = isBoundarySetAvailableForRiding(boundarySet)
        ? boundarySet.code
        : undefined;
      Object.assign(finalFilters, getFiltersForBoundarySet(boundarySetCode, finalFilters));
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
              const isAvailable = isBoundarySetAvailableForRiding(set);
              const isDisabled = !isAvailable;
              const statusLabel = !set.hasGeoJson
                ? "Riding boundaries unavailable"
                : set.hasDonationData === false
                  ? "Donation data unavailable"
                  : "Available";

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
                    {statusLabel}
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
