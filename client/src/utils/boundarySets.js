export const DATA_MAX_YEAR = 2024;
export const FUTURE_NO_DATA_YEAR = 2025;

export const BOUNDARY_SETS = [
  {
    code: "federal_ridings_1996",
    label: "1997–2003 · 1996 Riding Map",
    shortLabel: "1996 Map",
    validFromYear: 1997,
    validToYear: 2003,
    hasGeoJson: true,
    hasDonationData: false,
    note: "Uses the 1996 Representation Order riding boundaries.",
  },
  {
    code: "federal_ridings_2003",
    label: "2004–2014 · 2003 Riding Map",
    shortLabel: "2003 Map",
    validFromYear: 2004,
    validToYear: 2014,
    hasGeoJson: true,
    hasDonationData: true,
  },
  {
    code: "federal_ridings_2013",
    label: "2015–2024 · 2013 Riding Map",
    shortLabel: "2013 Map",
    validFromYear: 2015,
    validToYear: 2024,
    hasGeoJson: true,
    hasDonationData: true,
  },
  {
    code: "federal_ridings_2023",
    label: "2025 Onward · 2023 Riding Map",
    shortLabel: "2023 Map",
    validFromYear: 2025,
    validToYear: 2034,
    hasGeoJson: true,
    hasDonationData: false,
    note: "The 2023 Representation Orders are available for the map, but CDMP currently has no donation data for this time frame.",
    noDataMessage: "Currently there is no donation data available for this time frame.",
  },
];

export const DEFAULT_BOUNDARY_SET_CODE = "federal_ridings_2013";

export function getBoundarySetByCode(code) {
  return BOUNDARY_SETS.find((set) => set.code === code) || null;
}

export function getBoundarySetForYear(year) {
  const numericYear = Number(year);

  if (!Number.isInteger(numericYear)) return null;

  return (
    BOUNDARY_SETS.find(
      (set) =>
        numericYear >= set.validFromYear && numericYear <= set.validToYear,
    ) || null
  );
}

export function getBoundarySetForFilters(filters) {
  if (filters?.boundarySet) {
    const explicit = getBoundarySetByCode(filters.boundarySet);
    if (explicit) return explicit;
  }

  const endingYear = Number(filters?.endingYear || DATA_MAX_YEAR);
  return getBoundarySetForYear(endingYear) || getBoundarySetByCode(DEFAULT_BOUNDARY_SET_CODE);
}

export function getDefaultFilters() {
  const defaultBoundarySet = getBoundarySetByCode(DEFAULT_BOUNDARY_SET_CODE);

  return {
    partyCode: "ALL",
    beginningYear: 1993,
    endingYear: DATA_MAX_YEAR,
    metricMode: "total",
    boundarySet: defaultBoundarySet.code,
  };
}

export function getFiltersForBoundarySet(boundarySetCode, currentFilters = {}) {
  const boundarySet = getBoundarySetByCode(boundarySetCode) || getBoundarySetByCode(DEFAULT_BOUNDARY_SET_CODE);
  const endingYear = boundarySet.hasDonationData === false
    ? boundarySet.validFromYear
    : Math.min(boundarySet.validToYear, DATA_MAX_YEAR);

  return {
    ...currentFilters,
    boundarySet: boundarySet.code,
    beginningYear: boundarySet.validFromYear,
    endingYear,
  };
}
