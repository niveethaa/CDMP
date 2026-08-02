const PARTY_CODES = ["LPC", "CPC", "NDP", "BQ", "GPC", "PPC"];

const PARTY_NAMES = {
  LPC: "Liberal",
  CPC: "Conservative",
  NDP: "NDP",
  BQ: "Bloc Québécois",
  GPC: "Green",
  PPC: "People's Party",
};

const PROVINCE_NAMES = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  NT: "Northwest Territories",
  NU: "Nunavut",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
  YT: "Yukon",
};

function getPartyName(code) {
  return PARTY_NAMES[code] || code;
}

function getOtherParty(partyCodes) {
  const current = partyCodes[0] || "LPC";
  return PARTY_CODES.find((code) => code !== current) || "CPC";
}

function getAlternateYear(beginningYear, endingYear) {
  if (beginningYear === endingYear) {
    return beginningYear > 2004 ? beginningYear - 4 : beginningYear + 4;
  }
  return null;
}

function buildRegionContext(querySpec) {
  if (querySpec.regionLevel === "riding" && querySpec.provinceCode) {
    return `in ${PROVINCE_NAMES[querySpec.provinceCode] || querySpec.provinceCode}`;
  }
  if (querySpec.regionLevel === "province" && querySpec.regionCode) {
    return `in ${PROVINCE_NAMES[querySpec.regionCode] || querySpec.regionCode}`;
  }
  return "nationally";
}

function buildPartyContext(querySpec) {
  if (querySpec.partyCodes && querySpec.partyCodes.length) {
    return getPartyName(querySpec.partyCodes[0]);
  }
  return "all parties";
}

function buildPeriod(beginningYear, endingYear) {
  return beginningYear === endingYear
    ? String(beginningYear)
    : `${beginningYear}–${endingYear}`;
}

function generateSuggestions(querySpec) {
  if (!querySpec) return [];

  const suggestions = [];
  const party = buildPartyContext(querySpec);
  const region = buildRegionContext(querySpec);
  const otherParty = getPartyName(getOtherParty(querySpec.partyCodes || []));
  const period = buildPeriod(querySpec.beginningYear, querySpec.endingYear);
  const alternateYear = getAlternateYear(querySpec.beginningYear, querySpec.endingYear);

  if (querySpec.intent !== "trend") {
    suggestions.push(
      querySpec.beginningYear === querySpec.endingYear
        ? `Show the ${party} donation trend ${region} for ${querySpec.beginningYear}`
        : `Show the ${party} donation trend ${region} from ${querySpec.beginningYear} to ${querySpec.endingYear}`
    );
  }

  if (querySpec.intent !== "comparison" && querySpec.partyCodes?.length < 2) {
    suggestions.push(
      `Compare ${party} and ${otherParty} donations ${region} in ${period}`
    );
  }

  if (
    querySpec.beginningYear !== querySpec.endingYear
    && querySpec.intent !== "change"
  ) {
    suggestions.push(
      `Which party increased donations the most ${region} from ${querySpec.beginningYear} to ${querySpec.endingYear}?`
    );
  }

  if (querySpec.intent !== "ranking") {
    suggestions.push(
      `Which year had the most ${party} donations ${region} from ${querySpec.beginningYear} to ${querySpec.endingYear}?`
    );
  }

  if (alternateYear) {
    suggestions.push(
      `Show the same data for ${alternateYear}`
    );
  }

  if (querySpec.regionLevel === "national" && querySpec.intent !== "ranking") {
    suggestions.push(
      `Which province had the most ${party} donations in ${period}?`
    );
  }

  if (querySpec.regionLevel === "province" && querySpec.regionCode && querySpec.intent !== "ranking") {
    suggestions.push(
      `Which ridings in ${PROVINCE_NAMES[querySpec.regionCode] || querySpec.regionCode} had the most ${party} donations?`
    );
  }

  return suggestions.slice(0, 3);
}

export { generateSuggestions };
