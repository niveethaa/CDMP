import { getDefaultFilters } from "./boundarySets";

const METRIC_MODE_MAP = {
  perCapitaAmount: "per_capita",
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

function isMapCompatible(interpretedFilters) {
  if (!interpretedFilters) return false;
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

export { isMapCompatible, convertToMapFilters, getProvinceCode, getRidingCode };