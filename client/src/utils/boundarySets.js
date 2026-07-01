export const DATA_MAX_YEAR = 2024;
export const FUTURE_NO_DATA_YEAR = 2025;

export const BOUNDARY_SETS = [
  {
    code: "federal_ridings_1996",
    label: "1997–2003 · 1996 Riding Map",
    shortLabel: "1996 Map",
    validFromYear: 1997,
    validToYear: 2003,
    hasGeoJson: false,
    hasDonationData: false,
    note: "The 1996 riding boundaries and mapped donation data are not bundled yet.",
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
    noDataMessage: "This riding map is not available yet because boundary and donation data are missing.",
  },
];

export const DEFAULT_BOUNDARY_SET_CODE = "federal_ridings_2013";

export function getBoundarySetByCode(code) {
  return BOUNDARY_SETS.find((set) => set.code === code) || null;
}

export function isBoundarySetAvailableForRiding(boundarySet) {
  return Boolean(boundarySet?.hasGeoJson && boundarySet?.hasDonationData);
}

export function getDefaultRidingBoundarySet() {
  const defaultBoundarySet = getBoundarySetByCode(DEFAULT_BOUNDARY_SET_CODE);

  if (isBoundarySetAvailableForRiding(defaultBoundarySet)) {
    return defaultBoundarySet;
  }

  return BOUNDARY_SETS.find(isBoundarySetAvailableForRiding) || defaultBoundarySet;
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

export function getBoundarySetForFilters(filters, options = {}) {
  const requireRidingData = Boolean(options.requireRidingData);

  if (filters?.boundarySet) {
    const explicit = getBoundarySetByCode(filters.boundarySet);
    if (explicit && (!requireRidingData || isBoundarySetAvailableForRiding(explicit))) {
      return explicit;
    }
  }

  const endingYear = Number(filters?.endingYear || DATA_MAX_YEAR);
  const inferred = getBoundarySetForYear(endingYear);

  if (inferred && (!requireRidingData || isBoundarySetAvailableForRiding(inferred))) {
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
    beginningYear: 1993,
    endingYear: DATA_MAX_YEAR,
    metricMode: "total",
    boundarySet: defaultBoundarySet.code,
  };
}

export function getFiltersForBoundarySet(boundarySetCode, currentFilters = {}) {
  const selectedBoundarySet = getBoundarySetByCode(boundarySetCode);
  const boundarySet = isBoundarySetAvailableForRiding(selectedBoundarySet)
    ? selectedBoundarySet
    : getDefaultRidingBoundarySet();
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
