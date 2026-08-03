import { useMemo, useState, useRef } from "react";
import { askQuestion } from "../../api/askData";
import { isMapCompatible, convertToMapFilters, getProvinceCode, getRidingCode } from "../../utils/askDataFilters";
import {
  buildMapContextLabel,
  generateMapPrompts,
  generateSuggestions,
} from "../../utils/askDataSuggestions";

const PROVINCE_CODES = {
  "Alberta": "AB",
  "British Columbia": "BC",
  "Manitoba": "MB",
  "New Brunswick": "NB",
  "Newfoundland and Labrador": "NL",
  "Nova Scotia": "NS",
  "Northwest Territories": "NT",
  "Nunavut": "NU",
  "Ontario": "ON",
  "Prince Edward Island": "PE",
  "Quebec": "QC",
  "Saskatchewan": "SK",
  "Yukon": "YT",
};

function formatDollars(amount) {
  const value = Number(amount || 0);
  const sign = value < 0 ? "-" : "";
  const absoluteValue = Math.abs(value);
  if (absoluteValue >= 1_000_000) return `${sign}$${(absoluteValue / 1_000_000).toFixed(1)}M`;
  if (absoluteValue >= 1_000) return `${sign}$${(absoluteValue / 1_000).toFixed(0)}K`;
  return `${sign}$${absoluteValue.toFixed(0)}`;
}

function formatRowValue(value, metric) {
  if (value === null || value === undefined) return "—";
  const amount = Number(value);
  const isDollar = ["totalDonations", "averageDonation"].includes(metric || "");
  return isDollar ? formatDollars(amount) : amount.toLocaleString("en-CA");
}

function formatMetricLabel(metric) {
  const labels = {
    totalDonations: "Total Donations",
    donationCount: "Donation Count",
    donorCount: "Donor Count",
    averageDonation: "Average Donation",
  };
  return labels[metric] || metric;
}

function buildFilterSummary(interpretedFilters) {
  if (!interpretedFilters) return [];
  const parts = [];
  if (interpretedFilters.partyCodes && interpretedFilters.partyCodes.length) {
    parts.push(interpretedFilters.partyCodes.join(", "));
  }
  if (interpretedFilters.regionCode) parts.push(interpretedFilters.regionCode);
  if (interpretedFilters.regionCodes?.length) {
    parts.push(interpretedFilters.regionCodes.join(", "));
  }
  if (interpretedFilters.beginningYear && interpretedFilters.endingYear) {
    parts.push(`${interpretedFilters.beginningYear}–${interpretedFilters.endingYear}`);
  }
  if (interpretedFilters.metric) parts.push(formatMetricLabel(interpretedFilters.metric));
  return parts;
}

function formatResultValue(row, metric) {
  if (row.suppressed) return "Suppressed";
  if (row.unavailable) return "Unavailable";
  return formatRowValue(row.value, metric);
}

function AnswerCard({ result, onApplyFilters, onSuggestionClick }) {
  const filterSummary = buildFilterSummary(result.interpretedFilters);
  const compatible = isMapCompatible(result.interpretedFilters);
  const suggestions = generateSuggestions(result.interpretedFilters);
  const coverageNotes = result.coverage?.notes || [];
  const intentLabel = result.interpretedFilters?.intent
    ? result.interpretedFilters.intent.charAt(0).toUpperCase()
      + result.interpretedFilters.intent.slice(1)
    : "Answer";

  function handleApplyToMap() {
    if (!onApplyFilters || !result.interpretedFilters) return;
    const mapFilters = convertToMapFilters(result.interpretedFilters);
    const provinceCode = getProvinceCode(result.interpretedFilters);
    const ridingCode = getRidingCode(result.interpretedFilters);

    let topProvinceCode = provinceCode;
    if (!topProvinceCode && result.interpretedFilters.groupBy === "province" && result.data?.rows?.length) {
      const topRow = result.data.rows.find((row) => !row.suppressed && !row.unavailable);
      if (topRow) topProvinceCode = PROVINCE_CODES[topRow.label] || null;
    }

    onApplyFilters(mapFilters, topProvinceCode, ridingCode);
  }

  return (
    <div className="ask-answer-card">
      <div className="ask-answer-header">
        <span className="ask-answer-label">CDMP answer</span>
        <span className="ask-answer-intent">{intentLabel}</span>
      </div>

      <p className="ask-answer-text">{result.answer}</p>

      {filterSummary.length > 0 && (
        <div className="ask-filter-summary" aria-label="Query filters">
          {filterSummary.map((filter) => (
            <span key={filter}>{filter}</span>
          ))}
        </div>
      )}

      {result.coverage && (
        coverageNotes.length > 0 ? (
          <details className="ask-coverage">
            <summary>
              <span>Data coverage: {result.coverage.beginningYear}–{result.coverage.endingYear}</span>
              <span>{coverageNotes.length} {coverageNotes.length === 1 ? "limitation" : "limitations"}</span>
            </summary>
            <div className="ask-coverage-notes">
              {coverageNotes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          </details>
        ) : (
          <p className="ask-coverage-complete">
            Data coverage: {result.coverage.beginningYear}–{result.coverage.endingYear}
          </p>
        )
      )}

      {result.data && result.data.rows && result.data.rows.length > 0 && (
        <div className="ask-data-table">
          <div className="ask-results-header">
            <span>Results</span>
            <span>{formatMetricLabel(result.interpretedFilters?.metric)}</span>
          </div>
          {result.data.rows.map((row, i) => (
            <div key={i} className="ask-data-row">
              <span className="ask-data-label">{row.label}</span>
              <span className={`ask-data-value${row.suppressed || row.unavailable ? " ask-data-value--muted" : ""}`}>
                {formatResultValue(row, result.interpretedFilters?.metric)}
              </span>
            </div>
          ))}
        </div>
      )}

      {compatible && onApplyFilters && (
        <button className="ask-apply-btn" onClick={handleApplyToMap}>
          Apply to map
        </button>
      )}

      {!compatible && (
        <p className="ask-incompatible">
          This result uses multiple values, so it stays in the answer card.
        </p>
      )}

      {suggestions.length > 0 && (
        <div className="ask-suggestions">
          <p className="ask-suggestions-label">Follow-up questions:</p>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              className="ask-followup-btn"
              onClick={() => onSuggestionClick(suggestion)}
            >
              <span aria-hidden="true">↳</span>
              <span>{suggestion}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AskDataPanel({ currentFilters, onApplyFilters, onClearFilters }) {
  const panelRef = useRef(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [unsupported, setUnsupported] = useState(false);
  const [previousQuery, setPreviousQuery] = useState(null);
  const examplePrompts = useMemo(
    () => generateMapPrompts(currentFilters),
    [currentFilters],
  );
  const mapContextLabel = useMemo(
    () => buildMapContextLabel(currentFilters),
    [currentFilters],
  );

  async function handleSubmit(questionText) {
    const trimmed = (questionText || question).trim();
    if (!trimmed || loading) return;

    const scrollTop = panelRef.current?.parentElement?.scrollTop || 0;
    setLoading(true);
    setError(null);
    setResult(null);
    setUnsupported(false);

    try {
      const data = await askQuestion({
        question: trimmed,
        currentFilters: currentFilters || null,
        previousQuery: previousQuery || null,
      });
      setResult(data);
      setPreviousQuery(data.interpretedFilters || null);

      setTimeout(() => {
        const sidePanel = panelRef.current?.closest('.side-panel');
        if (sidePanel) {
          sidePanel.scrollTop = scrollTop;
        }
      }, 0);

    } catch (err) {
      setPreviousQuery(null);
      if (err.status === 422 || err.supported === false) {
        setUnsupported(true);
      } else if (err.status === 429) {
        setError("Too many requests. Please wait a moment and try again.");
      } else if (err.status === 503) {
        setError("The AI service is temporarily unavailable. Please try again later.");
      } else {
        setError(err.message || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleExampleClick(prompt) {
    setQuestion(prompt);
    setResult(null);
    setError(null);
    setUnsupported(false);
    setPreviousQuery(null);
  }

  function handleSuggestionClick(suggestion) {
    setQuestion(suggestion);
    handleSubmit(suggestion);
  }

  function handleStartOver() {
    setQuestion("");
    setResult(null);
    setError(null);
    setUnsupported(false);
    setPreviousQuery(null);
    if (onClearFilters) onClearFilters();
  }

  return (
    <div className="ask-panel" ref={panelRef}>
      <div className="ask-panel-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 className="ask-panel-title">Ask CDMP</h3>
          {previousQuery && (
            <button className="ask-start-over-btn" onClick={handleStartOver}>
              Start over
            </button>
          )}
        </div>
        <p className="ask-panel-subtitle">Ask a question about Canadian political donations.</p>
        {mapContextLabel && (
          <p className="ask-map-context">Current view: {mapContextLabel}</p>
        )}
      </div>

      <div className="ask-input-wrap">
        <input
          className="ask-input"
          type="text"
          placeholder="Ask a question…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          maxLength={500}
          aria-label="Ask a question about donation data"
        />
        {question && (
          <button
            className="ask-clear-btn"
            onClick={() => setQuestion("")}
            aria-label="Clear question"
          >
            ✕
          </button>
        )}
        <button
          className="ask-submit-btn"
          onClick={() => handleSubmit()}
          disabled={loading || !question.trim()}
          aria-label="Submit question"
        >
          {loading ? "…" : "Ask"}
        </button>
      </div>

      {!result && !error && !unsupported && !loading && (
        <div className="ask-examples">
          <p className="ask-examples-label">Try asking about this view:</p>
          {examplePrompts.map((prompt) => (
            <button
              key={prompt}
              className="ask-example-btn"
              onClick={() => handleExampleClick(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="ask-loading">
          <div className="panel-spinner" />
          <p>Thinking…</p>
        </div>
      )}

      {unsupported && (
        <div className="ask-unsupported">
          <p>This question is outside the supported CDMP aggregate queries.</p>
          <p className="ask-unsupported-hint">
            Try asking about totals, rankings, trends, comparisons, or changes by party, province, riding, or year.
          </p>
        </div>
      )}

      {error && (
        <div className="ask-error">
          <p>{error}</p>
        </div>
      )}

      {result && (
        <AnswerCard
          result={result}
          onApplyFilters={onApplyFilters}
          onSuggestionClick={handleSuggestionClick}
        />
      )}
    </div>
  );
}
