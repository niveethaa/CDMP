import { useState } from "react";

const PARTIES = [
  { code: "ALL", name: "All parties" },
  { code: "CPC", name: "Conservative" },
  { code: "LPC", name: "Liberal" },
  { code: "NDP", name: "New Democratic" },
  { code: "BQ", name: "Bloc Québécois" },
  { code: "GPC", name: "Green" },
  { code: "PPC", name: "People's" },
];

const MIN_YEAR = 2004;
const MAX_YEAR = 2024;

export default function DonationFilters({ filters, onApply, onClose }) {
  const [partyCode, setPartyCode] = useState(filters.partyCode);
  const [beginningYear, setBeginningYear] = useState(filters.beginningYear);
  const [endingYear, setEndingYear] = useState(filters.endingYear);

  function handleBeginningYear(value) {
    const y = Number(value);
    setBeginningYear(y);
    if (y > endingYear) setEndingYear(y);
  }

  function handleEndingYear(value) {
    const y = Number(value);
    setEndingYear(y);
    if (y < beginningYear) setBeginningYear(y);
  }

  function handleApply() {
    onApply({ partyCode, beginningYear, endingYear });
    onClose();
  }

  function handleReset() {
    setPartyCode("ALL");
    setBeginningYear(MIN_YEAR);
    setEndingYear(MAX_YEAR);
    onApply({ partyCode: "ALL", beginningYear: MIN_YEAR, endingYear: MAX_YEAR });
    onClose();
  }

  const years = [];
  for (let y = MIN_YEAR; y <= MAX_YEAR; y++) years.push(y);

  return (
    <div className="filters-popover">
      <div className="filters-header">
        <h3 className="filters-title">Filter donations</h3>
        <button className="filters-close" onClick={onClose} aria-label="Close filters">
          ✕
        </button>
      </div>

      <div className="filters-field">
        <label className="filters-label">Party</label>
        <select
          className="filters-select"
          value={partyCode}
          onChange={(e) => setPartyCode(e.target.value)}
        >
          {PARTIES.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="filters-field">
        <label className="filters-label">From year</label>
        <select
          className="filters-select"
          value={beginningYear}
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
          value={endingYear}
          onChange={(e) => handleEndingYear(e.target.value)}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

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