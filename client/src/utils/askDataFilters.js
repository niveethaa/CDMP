import { getDefaultFilters } from "./boundarySets";

const METRIC_MODE_MAP = {
  donationCount: "donation_count",
};

function getMetricMode(metric) {
  return METRIC_MODE_MAP[metric] || "total";
}

function getPartyCode(partyCodes) {
  if (!partyCodes || partyCodes.length === 0) return "ALL";
  return partyCodes.join(",");
}

function getRidingCode(interpretedFilters) {
  if (interpretedFilters.regionLevel === "riding") {
    return interpretedFilters.regionCode || null;
  }
  return null;
}

function normalizeRidingIdentifier(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findRidingByIdentifier(ridingStats, identifier) {
  const normalizedIdentifier = normalizeRidingIdentifier(identifier);
  if (!normalizedIdentifier) return null;

  return (ridingStats || []).find((stat) => {
    const region = stat?.region;
    return normalizeRidingIdentifier(region?.code) === normalizedIdentifier
      || normalizeRidingIdentifier(region?.name) === normalizedIdentifier;
  }) || null;
}

function isMapCompatible(interpretedFilters) {
  if (!interpretedFilters) return false;
  if (interpretedFilters.intent === "change") return false;
  if (interpretedFilters.intent === "comparison") return false;
  if (interpretedFilters.metric === "perCapitaAmount") return false;
  if (interpretedFilters.partyCodes?.length > 1) return false;
  if (interpretedFilters.regionCodes?.length) return false;
  if (interpretedFilters.regionLevel === "riding" && !interpretedFilters.boundarySet) return false;
  return true;
}

function convertToMapFilters(interpretedFilters) {
  if (!interpretedFilters) return null;
  const isRiding = interpretedFilters.regionLevel === "riding";
  return {
    partyCode: getPartyCode(interpretedFilters.partyCodes),
    beginningYear: interpretedFilters.beginningYear,
    endingYear: interpretedFilters.endingYear,
    metricMode: getMetricMode(interpretedFilters.metric),
    boundarySet: isRiding ? (interpretedFilters.boundarySet || getDefaultFilters().boundarySet) : getDefaultFilters().boundarySet,
  };
}

function getProvinceCode(interpretedFilters) {
  if (interpretedFilters.regionLevel === "province") {
    return interpretedFilters.regionCode || null;
  }
  if (interpretedFilters.regionLevel === "riding") {
    return interpretedFilters.provinceCode || null;
  }
  return null;
}

export {
  isMapCompatible,
  convertToMapFilters,
  findRidingByIdentifier,
  getProvinceCode,
  getRidingCode,
};
