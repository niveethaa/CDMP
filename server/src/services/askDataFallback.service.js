const {
  DEFAULT_QUERY_YEAR,
  DEFAULT_TREND_BEGINNING_YEAR,
  SUPPORTED_PARTY_CODES,
} = require("./querySpec.service");
const { boundarySetForPeriod } = require("./ridingContext.service");

const PROVINCES = [
  ["newfoundland and labrador", "NL"],
  ["northwest territories", "NT"],
  ["prince edward island", "PE"],
  ["british columbia", "BC"],
  ["new brunswick", "NB"],
  ["nova scotia", "NS"],
  ["saskatchewan", "SK"],
  ["manitoba", "MB"],
  ["ontario", "ON"],
  ["alberta", "AB"],
  ["nunavut", "NU"],
  ["quebec", "QC"],
  ["yukon", "YT"],
];

const PARTY_PATTERNS = [
  ["LPC", /\b(?:liberal|liberals|lpc)\b/i],
  ["CPC", /\b(?:conservative|conservatives|cpc|tories|tory)\b/i],
  ["NDP", /\b(?:ndp|new democratic)\b/i],
  ["BQ", /\b(?:bloc|bq)\b/i],
  ["GPC", /\b(?:green|greens|gpc)\b/i],
  ["PPC", /\b(?:people'?s party|ppc)\b/i],
];

const NUMBER_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function unique(values) {
  return [...new Set(values)];
}

function findYears(question) {
  return unique([...question.matchAll(/\b(?:19|20)\d{2}\b/g)]
    .map((match) => Number(match[0])));
}

function findParties(question) {
  return PARTY_PATTERNS
    .filter(([, pattern]) => pattern.test(question))
    .map(([code]) => code);
}

function findProvinces(question) {
  return unique(PROVINCES
    .filter(([name]) => new RegExp(`\\b${name}\\b`, "i").test(question))
    .map(([, code]) => code));
}

function findLimit(question, fallback) {
  const digit = question.match(/\b(?:top|bottom|first|which|show|list|rank)?\s*(10|[1-9])\b/i);
  if (digit) return Number(digit[1]);
  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(question)) return value;
  }
  return fallback;
}

function detectMetric(question) {
  if (/\b(?:average|mean)\s+(?:donation|gift|contribution)/i.test(question)) {
    return "averageDonation";
  }
  if (/\b(?:donor|donors|supporter|supporters|contributors)\s+(?:count|counts|number)?/i.test(question)
    || /\bhow many\b[^?]{0,40}\b(?:donors|supporters|contributors)\b/i.test(question)) {
    return "donorCount";
  }
  if (/\b(?:donation|donations|gift|gifts|contribution|contributions)\s+(?:count|counts|number)/i.test(question)
    || /\bhow many\b[^?]{0,40}\b(?:donations|gifts|contributions)\b/i.test(question)) {
    return "donationCount";
  }
  return "totalDonations";
}

function hasMetricSignal(question) {
  return /\b(?:average|mean|per[ -]?capita|per person|donor|donors|supporter|supporters|contributors|donation|donations|gift|gifts|contribution|contributions|amount|money|fundrais|raised|received)\w*/i
    .test(question);
}

function detectIntent(question) {
  if (/\b(?:increase|increased|decrease|decreased|change|changed|grew|growth|fell|drop|dropped|gain|gained)\w*/i.test(question)) {
    return "change";
  }
  if (/\b(?:trend|track|tracked|over time|each year|chart|plot)\b/i.test(question)) {
    return "trend";
  }
  if (/\b(?:compare|comparison|versus|vs\.?|against)\b/i.test(question)
    || /\bwho\s+(?:raised|received|got)\s+more\b/i.test(question)) {
    return "comparison";
  }
  if (/\b(?:rank|ranking|top|bottom|highest|lowest|most|least|fewest|best|worst|largest|smallest)\b/i.test(question)) {
    return "ranking";
  }
  return "summary";
}

function hasIntentSignal(question) {
  return /\b(?:increase|decrease|change|grew|growth|fell|drop|gain|trend|track|over time|each year|chart|plot|compare|comparison|versus|vs\.?|against|rank|ranking|top|bottom|highest|lowest|most|least|fewest|best|worst|largest|smallest)\w*/i
    .test(question)
    || /\bwho\s+(?:raised|received|got)\s+more\b/i.test(question);
}

function periodForFallback(question, intent, previousQuery) {
  const years = findYears(question);
  if (years.length) {
    return {
      beginningYear: Math.min(...years),
      endingYear: Math.max(...years),
    };
  }
  if (previousQuery) {
    if (
      ["trend", "change"].includes(intent)
      && previousQuery.beginningYear === previousQuery.endingYear
    ) {
      return {
        beginningYear: DEFAULT_TREND_BEGINNING_YEAR,
        endingYear: DEFAULT_QUERY_YEAR,
      };
    }
    return {
      beginningYear: previousQuery.beginningYear,
      endingYear: previousQuery.endingYear,
    };
  }
  return {
    beginningYear: ["trend", "change"].includes(intent)
      ? DEFAULT_TREND_BEGINNING_YEAR
      : DEFAULT_QUERY_YEAR,
    endingYear: DEFAULT_QUERY_YEAR,
  };
}

function groupForFallback(question, intent, parties, provinces, years) {
  if (intent === "summary") return null;
  if (intent === "trend") return "year";
  if (intent === "change") {
    return /\bprovinces?\b/i.test(question) || provinces.length > 1
      ? "province"
      : "party";
  }
  if (intent === "comparison") {
    if (years.length > 1 && provinces.length <= 1 && parties.length <= 1) return "year";
    if (provinces.length > 1) return "province";
    if (parties.length > 1 || /\b(?:all|every|each)\s+part(?:y|ies)\b/i.test(question)) {
      return "party";
    }
    return null;
  }
  if (/\bridings?\b/i.test(question)) return "riding";
  if (/\bpart(?:y|ies)\b/i.test(question)) return "party";
  if (/\bprovinces?\b/i.test(question)) return "province";
  if (/\byears?\b/i.test(question)) return "year";
  return null;
}

function buildFallbackQuerySpec({ question, ridingContext, previousQuery }) {
  const text = String(question || "");
  if (
    !previousQuery
    && !/\b(?:donat|donor|contribut|fundrais|raised|received|gift|party|parties|province|provinces|riding|ridings)\w*/i.test(text)
  ) {
    return null;
  }

  const intent = previousQuery && !hasIntentSignal(text)
    ? previousQuery.intent
    : detectIntent(text);
  const metric = previousQuery && !hasMetricSignal(text)
    ? previousQuery.metric
    : detectMetric(text);
  const years = findYears(text);
  const foundParties = findParties(text);
  const parties = previousQuery && !foundParties.length && !/\bpart(?:y|ies)\b/i.test(text)
    ? [...previousQuery.partyCodes]
    : foundParties;
  const provinces = findProvinces(text);
  const detectedGroup = groupForFallback(text, intent, parties, provinces, years);
  const groupBy = previousQuery && !hasIntentSignal(text)
    ? previousQuery.groupBy
    : detectedGroup;
  const period = periodForFallback(text, intent, previousQuery);
  const allParties = /\b(?:all|every|each)\s+(?:six\s+)?part(?:y|ies)\b/i.test(text);
  let partyCodes = parties;
  let regionCodes = [];
  let regionLevel = "national";
  let regionCode = null;
  let provinceCode = null;
  let boundarySet = null;

  if (intent === "comparison" && groupBy === "party" && allParties) {
    partyCodes = [...SUPPORTED_PARTY_CODES];
  }
  if (intent === "trend" && allParties) partyCodes = [...SUPPORTED_PARTY_CODES];
  if ((intent === "ranking" || intent === "change") && groupBy === "party") {
    partyCodes = [];
  }
  if (groupBy === "province" && ["comparison", "change"].includes(intent)) {
    regionCodes = provinces;
    regionLevel = "province";
    provinceCode = null;
    regionCode = null;
    if (partyCodes.length > 1) partyCodes = partyCodes.slice(0, 1);
  } else if (groupBy === "province" && intent === "ranking") {
    regionLevel = "province";
  } else if (ridingContext?.name && !ridingContext.ambiguous) {
    regionLevel = "riding";
    regionCode = intent === "ranking" && groupBy === "riding"
      ? null
      : ridingContext.name;
    provinceCode = ridingContext.provinceCode;
    boundarySet = boundarySetForPeriod(
      period.beginningYear,
      period.endingYear,
    ) || ridingContext.boundarySet;
  } else if (groupBy === "riding" && provinces.length === 1) {
    regionLevel = "riding";
    provinceCode = provinces[0];
    boundarySet = boundarySetForPeriod(period.beginningYear, period.endingYear);
  } else if (provinces.length === 1) {
    regionLevel = "province";
    regionCode = provinces[0];
    provinceCode = provinces[0];
  } else if (
    previousQuery?.regionLevel === "riding"
    && !/\b(?:canada|national|nationally|nationwide|provinces?)\b/i.test(text)
  ) {
    regionLevel = "riding";
    regionCode = intent === "ranking" && groupBy === "riding"
      ? null
      : previousQuery.regionCode;
    provinceCode = previousQuery.provinceCode;
    boundarySet = boundarySetForPeriod(
      period.beginningYear,
      period.endingYear,
    ) || previousQuery.boundarySet;
  }

  if (intent === "comparison" && !["party", "province", "year"].includes(groupBy)) {
    return null;
  }
  if (intent === "ranking" && !["party", "province", "riding", "year"].includes(groupBy)) {
    return null;
  }
  if (intent === "change" && !["party", "province"].includes(groupBy)) return null;
  if (regionLevel === "riding" && !boundarySet) return null;

  const hasDirection = /\b(?:highest|most|top|largest|increase|increased|gain|gained|lowest|least|fewest|bottom|worst|smallest|decrease|decreased|drop|dropped|fell)\w*/i.test(text);
  const ascending = hasDirection
    ? /\b(?:lowest|least|fewest|bottom|worst|smallest|decrease|decreased|drop|dropped|fell)\w*/i.test(text)
    : previousQuery?.sortOrder === "asc";
  const defaultLimit = intent === "summary"
    ? 1
    : intent === "comparison"
      ? Math.max(2, groupBy === "party" ? partyCodes.length : groupBy === "province" ? regionCodes.length : 2)
      : previousQuery && !hasIntentSignal(text)
        ? previousQuery.limit
      : /\bwhich\b[^?]{0,40}\b(?:party|province|riding|year)\b(?!s)/i.test(text)
        ? 1
        : 5;

  return {
    intent,
    metric,
    groupBy,
    partyCodes,
    regionCodes,
    regionLevel,
    regionCode,
    provinceCode,
    beginningYear: period.beginningYear,
    endingYear: period.endingYear,
    boundarySet,
    limit: Math.min(findLimit(text, defaultLimit), 10),
    sortOrder: ascending ? "asc" : "desc",
  };
}

module.exports = {
  buildFallbackQuerySpec,
  detectIntent,
  detectMetric,
  findParties,
  findProvinces,
};
