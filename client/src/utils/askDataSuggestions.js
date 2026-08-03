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
    const province = PROVINCE_NAMES[querySpec.provinceCode] || querySpec.provinceCode;
    return querySpec.regionCode
      ? `in ${querySpec.regionCode}, ${province}`
      : `in ${province}`;
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

function buildTrendContext(querySpec) {
  if (querySpec.partyCodes && querySpec.partyCodes.length) {
    return `${getPartyName(querySpec.partyCodes[0])} donation`;
  }
  return "total donation";
}

function buildDonationContext(querySpec) {
  if (querySpec.partyCodes && querySpec.partyCodes.length) {
    return `${getPartyName(querySpec.partyCodes[0])} donations`;
  }
  return "total donations across all parties";
}

function buildPeriod(beginningYear, endingYear) {
  return beginningYear === endingYear
    ? String(beginningYear)
    : `${beginningYear}–${endingYear}`;
}

function buildQuestionPeriod(beginningYear, endingYear) {
  return beginningYear === endingYear
    ? `in ${beginningYear}`
    : `from ${beginningYear} to ${endingYear}`;
}

function getMapRegionContext(filters) {
  if (filters.regionLevel === "riding" && filters.regionCode) {
    const province = PROVINCE_NAMES[filters.provinceCode] || filters.provinceCode;
    return {
      label: province ? `${filters.regionCode}, ${province}` : filters.regionCode,
      phrase: province
        ? `in ${filters.regionCode}, ${province}`
        : `in ${filters.regionCode}`,
    };
  }

  if (filters.regionLevel === "province") {
    const code = filters.regionCode || filters.provinceCode;
    const province = PROVINCE_NAMES[code] || code;
    return {
      label: province,
      phrase: `in ${province}`,
    };
  }

  return {
    label: "Canada",
    phrase: "nationally",
  };
}

function getMapPartyContext(filters) {
  const code = filters.partyCode;
  if (!code || code === "ALL") {
    return {
      code: null,
      name: "all parties",
    };
  }

  return {
    code,
    name: getPartyName(code),
  };
}

function generateMapPrompts(filters) {
  if (!filters?.beginningYear || !filters?.endingYear) return [];

  const region = getMapRegionContext(filters);
  const party = getMapPartyContext(filters);
  const period = buildQuestionPeriod(filters.beginningYear, filters.endingYear);
  const isCount = filters.metricMode === "donation_count";
  const prompts = [];

  if (party.code) {
    prompts.push(
      isCount
        ? `How many ${party.name} donations were made ${region.phrase} ${period}?`
        : `How much did ${party.name} receive ${region.phrase} ${period}?`,
    );
    const otherParty = getPartyName(getOtherParty([party.code]));
    prompts.push(
      isCount
        ? `Compare ${party.name} and ${otherParty} donation counts ${region.phrase} ${period}.`
        : `Compare ${party.name} and ${otherParty} donations ${region.phrase} ${period}.`,
    );
  } else {
    prompts.push(
      isCount
        ? `How many donations were made ${region.phrase} ${period}?`
        : `How much was donated ${region.phrase} ${period}?`,
    );
    prompts.push(
      isCount
        ? `Compare donation counts across all six parties ${region.phrase} ${period}.`
        : `Compare donations across all six parties ${region.phrase} ${period}.`,
    );
  }

  const partyPrefix = party.code ? `${party.name} ` : "";
  const metricPhrase = isCount ? "donation counts" : "donations";
  const rankingPhrase = isCount ? "the highest" : "the most";

  if (filters.regionLevel === "national") {
    prompts.push(
      `Which province had ${rankingPhrase} ${partyPrefix}${metricPhrase} ${period}?`,
    );
  } else if (filters.regionLevel === "province") {
    const province = PROVINCE_NAMES[filters.regionCode || filters.provinceCode]
      || filters.regionCode
      || filters.provinceCode;
    prompts.push(
      `Which ridings in ${province} had ${rankingPhrase} ${partyPrefix}${metricPhrase} ${period}?`,
    );
  } else {
    prompts.push(
      `Rank all parties by ${metricPhrase} ${region.phrase} ${period}.`,
    );
  }

  const trendBeginningYear = filters.beginningYear === filters.endingYear
    ? Math.max(1993, filters.endingYear - 4)
    : filters.beginningYear;
  const trendParty = party.code ? `${party.name} ` : "";
  prompts.push(
    `Show the ${trendParty}${isCount ? "donation count" : "donation"} trend ${region.phrase} from ${trendBeginningYear} to ${filters.endingYear}.`,
  );

  return prompts.slice(0, 4);
}

function buildMapContextLabel(filters) {
  if (!filters?.beginningYear || !filters?.endingYear) return null;

  const region = getMapRegionContext(filters);
  const party = getMapPartyContext(filters);
  const period = buildPeriod(filters.beginningYear, filters.endingYear);
  const metric = filters.metricMode === "donation_count"
    ? "Donation count"
    : "Donation amount";

  return `${region.label} · ${party.name} · ${period} · ${metric}`;
}

function generateSuggestions(querySpec) {
  if (!querySpec) return [];

  const suggestions = [];
  const party = buildPartyContext(querySpec);
  const trendContext = buildTrendContext(querySpec);
  const donationContext = buildDonationContext(querySpec);
  const region = buildRegionContext(querySpec);
  const otherParty = getPartyName(getOtherParty(querySpec.partyCodes || []));
  const period = buildPeriod(querySpec.beginningYear, querySpec.endingYear);
  const alternateYear = getAlternateYear(querySpec.beginningYear, querySpec.endingYear);

  if (querySpec.intent !== "trend") {
    suggestions.push(
      querySpec.beginningYear === querySpec.endingYear
        ? `Show the ${trendContext} trend ${region} from ${Math.min(alternateYear, querySpec.beginningYear)} to ${Math.max(alternateYear, querySpec.beginningYear)}`
        : `Show the ${trendContext} trend ${region} from ${querySpec.beginningYear} to ${querySpec.endingYear}`
    );
  }

  if (querySpec.intent !== "comparison" && querySpec.partyCodes?.length < 2) {
    suggestions.push(
      querySpec.partyCodes?.length
        ? `Compare ${party} and ${otherParty} donations ${region} in ${period}`
        : `Compare donations across all six parties ${region} in ${period}`
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

  if (
    querySpec.intent !== "ranking"
    && querySpec.beginningYear !== querySpec.endingYear
  ) {
    suggestions.push(
      `Which year had the most ${donationContext} ${region} from ${querySpec.beginningYear} to ${querySpec.endingYear}?`
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
      `Which ridings in ${PROVINCE_NAMES[querySpec.regionCode] || querySpec.regionCode} had the most ${party} donations in ${period}?`
    );
  }

  return suggestions.slice(0, 3);
}

export { buildMapContextLabel, generateMapPrompts, generateSuggestions };
