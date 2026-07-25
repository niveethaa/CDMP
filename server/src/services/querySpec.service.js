const DATA_BEGINNING_YEAR = 1993;
const DATA_ENDING_YEAR = 2024;

const SUPPORTED_INTENTS = ["summary", "ranking", "trend", "comparison"];
const SUPPORTED_METRICS = [
  "totalDonations",
  "donationCount",
  "donorCount",
  "averageDonation",
  "perCapitaAmount",
];
const SUPPORTED_GROUPS = [null, "party", "province", "riding", "year"];
const SUPPORTED_REGION_LEVELS = ["national", "province", "riding"];
const SUPPORTED_PARTY_CODES = ["LPC", "CPC", "NDP", "BQ", "GPC", "PPC"];
const SUPPORTED_PROVINCE_CODES = [
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
];

const RIDING_BOUNDARY_SETS = {
  federal_ridings_1996: { beginningYear: 1997, endingYear: 2003 },
  federal_ridings_2003: { beginningYear: 2004, endingYear: 2014 },
  federal_ridings_2013: { beginningYear: 2015, endingYear: 2024 },
};

const ALLOWED_FIELDS = [
  "intent",
  "metric",
  "groupBy",
  "partyCodes",
  "regionLevel",
  "regionCode",
  "provinceCode",
  "beginningYear",
  "endingYear",
  "boundarySet",
  "limit",
];

class QuerySpecValidationError extends Error {
  constructor(errors) {
    super(errors[0] || "The query specification is invalid.");
    this.name = "QuerySpecValidationError";
    this.code = "INVALID_QUERY_SPEC";
    this.errors = errors;
  }
}

function isPlainObject(value) {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
  );
}

function findMongoOperator(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const operator = findMongoOperator(item);
      if (operator) return operator;
    }
    return null;
  }

  if (!isPlainObject(value)) return null;

  for (const [key, item] of Object.entries(value)) {
    if (key.startsWith("$")) return key;
    const operator = findMongoOperator(item);
    if (operator) return operator;
  }

  return null;
}

function normalizeOptionalCode(value) {
  if (value === undefined || value === null || value === "") return null;
  return String(value).trim().toUpperCase();
}

function validateQuerySpec(input) {
  const errors = [];

  if (!isPlainObject(input)) {
    throw new QuerySpecValidationError([
      "QuerySpec must be a plain JSON object.",
    ]);
  }

  const mongoOperator = findMongoOperator(input);
  if (mongoOperator) {
    errors.push("MongoDB operators are not allowed in QuerySpec.");
  }

  const unknownFields = Object.keys(input).filter(
    (field) => !ALLOWED_FIELDS.includes(field),
  );
  if (unknownFields.length) {
    errors.push(`Unknown QuerySpec field: ${unknownFields.join(", ")}.`);
  }

  const intent = input.intent;
  const metric = input.metric || "totalDonations";
  const groupBy = input.groupBy === undefined ? null : input.groupBy;
  const regionLevel = input.regionLevel || "national";
  const beginningYear = input.beginningYear ?? DATA_BEGINNING_YEAR;
  const endingYear = input.endingYear ?? DATA_ENDING_YEAR;
  const limit = input.limit ?? 5;
  const boundarySet = input.boundarySet || null;
  let regionCode = normalizeOptionalCode(input.regionCode);
  let provinceCode = normalizeOptionalCode(input.provinceCode);

  if (!SUPPORTED_INTENTS.includes(intent)) {
    errors.push(`Unsupported intent: ${String(intent)}.`);
  }
  if (!SUPPORTED_METRICS.includes(metric)) {
    errors.push(`Unsupported metric: ${String(metric)}.`);
  }
  if (!SUPPORTED_GROUPS.includes(groupBy)) {
    errors.push(`Unsupported groupBy value: ${String(groupBy)}.`);
  }
  if (!SUPPORTED_REGION_LEVELS.includes(regionLevel)) {
    errors.push(`Unsupported region level: ${String(regionLevel)}.`);
  }

  let partyCodes = [];
  if (input.partyCodes !== undefined) {
    if (!Array.isArray(input.partyCodes)) {
      errors.push("partyCodes must be an array.");
    } else {
      partyCodes = input.partyCodes.map((code) =>
        String(code).trim().toUpperCase(),
      );
      const invalidPartyCodes = partyCodes.filter(
        (code) => !SUPPORTED_PARTY_CODES.includes(code),
      );
      if (invalidPartyCodes.length) {
        errors.push(`Unsupported party code: ${invalidPartyCodes.join(", ")}.`);
      }
      if (new Set(partyCodes).size !== partyCodes.length) {
        errors.push("partyCodes cannot contain duplicates.");
      }
    }
  }

  if (
    !Number.isInteger(beginningYear)
    || beginningYear < DATA_BEGINNING_YEAR
    || beginningYear > DATA_ENDING_YEAR
  ) {
    errors.push(
      `beginningYear must be between ${DATA_BEGINNING_YEAR} and ${DATA_ENDING_YEAR}.`,
    );
  }
  if (
    !Number.isInteger(endingYear)
    || endingYear < DATA_BEGINNING_YEAR
    || endingYear > DATA_ENDING_YEAR
  ) {
    errors.push(
      `endingYear must be between ${DATA_BEGINNING_YEAR} and ${DATA_ENDING_YEAR}.`,
    );
  }
  if (
    Number.isInteger(beginningYear)
    && Number.isInteger(endingYear)
    && beginningYear > endingYear
  ) {
    errors.push("beginningYear cannot be after endingYear.");
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 5) {
    errors.push("limit must be an integer between 1 and 5.");
  }

  if (regionLevel === "national") {
    if (regionCode && regionCode !== "CA") {
      errors.push("National queries must use regionCode CA.");
    }
    regionCode = "CA";
    provinceCode = null;
  }

  if (regionLevel === "province") {
    if (regionCode && !SUPPORTED_PROVINCE_CODES.includes(regionCode)) {
      errors.push(`Unsupported province regionCode: ${regionCode}.`);
    }
    if (provinceCode && !SUPPORTED_PROVINCE_CODES.includes(provinceCode)) {
      errors.push(`Unsupported provinceCode: ${provinceCode}.`);
    }
    if (regionCode && provinceCode && regionCode !== provinceCode) {
      errors.push("regionCode and provinceCode must identify the same province.");
    }
    regionCode = regionCode || provinceCode;
    provinceCode = provinceCode || regionCode;
  }

  if (regionLevel === "riding") {
    if (!provinceCode || !SUPPORTED_PROVINCE_CODES.includes(provinceCode)) {
      errors.push("Riding queries require a supported provinceCode.");
    }
    if (!boundarySet || !RIDING_BOUNDARY_SETS[boundarySet]) {
      errors.push("Riding queries require a supported boundarySet.");
    } else {
      const boundaryYears = RIDING_BOUNDARY_SETS[boundarySet];
      if (
        beginningYear < boundaryYears.beginningYear
        || endingYear > boundaryYears.endingYear
      ) {
        errors.push(
          `${boundarySet} only supports ${boundaryYears.beginningYear}–${boundaryYears.endingYear}.`,
        );
      }
    }
    if (intent !== "ranking" && !regionCode) {
      errors.push("A riding regionCode is required for this query.");
    }
  } else if (boundarySet) {
    errors.push("boundarySet is only supported for riding queries.");
  }

  if (intent === "trend" && groupBy !== "year") {
    errors.push("Trend queries must group by year.");
  }
  if (intent === "summary" && groupBy !== null) {
    errors.push("Summary queries cannot use groupBy.");
  }
  if (intent === "comparison") {
    if (partyCodes.length !== 2) {
      errors.push("Comparison queries require exactly two party codes.");
    }
    if (groupBy !== "party") {
      errors.push("Comparison queries must group by party.");
    }
  } else if (partyCodes.length > 1) {
    errors.push("Only comparison queries can include multiple party codes.");
  }
  if (intent === "ranking" && groupBy === "province") {
    if (regionLevel !== "province") {
      errors.push("Province rankings must use regionLevel province.");
    }
    regionCode = null;
    provinceCode = null;
  } else if (regionLevel === "province" && !regionCode) {
    errors.push("Province queries require a province code.");
  }
  if (intent === "ranking" && groupBy === "riding") {
    if (regionLevel !== "riding") {
      errors.push("Riding rankings must use regionLevel riding.");
    }
    regionCode = null;
  }
  if (intent === "ranking" && !["party", "province", "riding"].includes(groupBy)) {
    errors.push("Ranking queries must group by party, province, or riding.");
  }

  if (errors.length) {
    throw new QuerySpecValidationError(errors);
  }

  return Object.freeze({
    intent,
    metric,
    groupBy,
    partyCodes: Object.freeze([...partyCodes]),
    regionLevel,
    regionCode,
    provinceCode,
    beginningYear,
    endingYear,
    boundarySet,
    limit,
  });
}

module.exports = {
  ALLOWED_FIELDS,
  DATA_BEGINNING_YEAR,
  DATA_ENDING_YEAR,
  QuerySpecValidationError,
  RIDING_BOUNDARY_SETS,
  SUPPORTED_GROUPS,
  SUPPORTED_INTENTS,
  SUPPORTED_METRICS,
  SUPPORTED_PARTY_CODES,
  SUPPORTED_PROVINCE_CODES,
  SUPPORTED_REGION_LEVELS,
  validateQuerySpec,
};
