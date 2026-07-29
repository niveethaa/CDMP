export const DATA_MIN_YEAR = 1993;
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
    hasDonationData: true,
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
    hasGeoJson: false,
    hasDonationData: false,
    note: "The 2023 riding boundaries and mapped donation data are not bundled yet.",
    noDataMessage:
      "This riding map is not available yet because boundary and donation data are missing.",
  },
];

export const DEFAULT_BOUNDARY_SET_CODE = "federal_ridings_2013";

export function getBoundarySetByCode(code) {
  return BOUNDARY_SETS.find((set) => set.code === code) || null;
}

// Selectable = we can DRAW it. Whether it has donations is a separate question.
export function isBoundarySetAvailableForRiding(boundarySet) {
  return Boolean(boundarySet?.hasGeoJson);
}

export function boundarySetHasDonationData(boundarySet) {
  return boundarySet?.hasDonationData !== false;
}

export function getDefaultRidingBoundarySet() {
  const preferred = getBoundarySetByCode(DEFAULT_BOUNDARY_SET_CODE);

  if (
    isBoundarySetAvailableForRiding(preferred) &&
    boundarySetHasDonationData(preferred)
  ) {
    return preferred;
  }

  return (
    BOUNDARY_SETS.find(
      (set) =>
        isBoundarySetAvailableForRiding(set) && boundarySetHasDonationData(set),
    ) || preferred
  );
}

export function getBoundarySetForYear(year) {
  const numericYear = Number(year);

  if (!Number.isInteger(numericYear)) return null;

  return (
    BOUNDARY_SETS.find(
      (set) =>
        numericYear >= set.validFromYear &&
        (set.validToYear === null || numericYear <= set.validToYear),
    ) || null
  );
}

export function getBoundarySetForFilters(filters, options = {}) {
  const requireRidingData = Boolean(options.requireRidingData);

  if (filters?.boundarySet) {
    const explicit = getBoundarySetByCode(filters.boundarySet);
    if (
      explicit &&
      (!requireRidingData || isBoundarySetAvailableForRiding(explicit))
    ) {
      return explicit;
    }
  }

  const endingYear = Number(filters?.endingYear || DATA_MAX_YEAR);
  const inferred = getBoundarySetForYear(endingYear);

  if (
    inferred &&
    (!requireRidingData || isBoundarySetAvailableForRiding(inferred))
  ) {
    return inferred;
  }

  return requireRidingData
    ? getDefaultRidingBoundarySet()
    : getBoundarySetByCode(DEFAULT_BOUNDARY_SET_CODE);
}

export function getDefaultFilters() {
  const defaultBoundarySet = getDefaultRidingBoundarySet();

  return {
    partyCode: "ALL",
    beginningYear: DATA_MIN_YEAR,
    endingYear: DATA_MAX_YEAR,
    metricMode: "total",
    boundarySet: defaultBoundarySet.code,
  };
}

export function getFiltersForBoundarySet(boundarySetCode, currentFilters = {}) {
  const selected = getBoundarySetByCode(boundarySetCode);
  const boundarySet = isBoundarySetAvailableForRiding(selected)
    ? selected
    : getDefaultRidingBoundarySet();

  const endingYear = boundarySetHasDonationData(boundarySet)
    ? Math.min(boundarySet.validToYear, DATA_MAX_YEAR)
    : boundarySet.validFromYear;

  return {
    ...currentFilters,
    boundarySet: boundarySet.code,
    beginningYear: boundarySet.validFromYear,
    endingYear,
  };
}
