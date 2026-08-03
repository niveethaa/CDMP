const Region = require("../models/Region");
const { RIDING_BOUNDARY_SETS } = require("./querySpec.service");

let ridingCatalogPromise = null;
const PROVINCE_NAMES = new Set([
  "alberta",
  "british columbia",
  "manitoba",
  "new brunswick",
  "newfoundland and labrador",
  "nova scotia",
  "northwest territories",
  "nunavut",
  "ontario",
  "prince edward island",
  "quebec",
  "saskatchewan",
  "yukon",
]);

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function boundarySetForPeriod(beginningYear, endingYear) {
  return Object.entries(RIDING_BOUNDARY_SETS).find(([, years]) =>
    beginningYear >= years.beginningYear && endingYear <= years.endingYear,
  )?.[0] || null;
}

function includesPhrase(question, phrase) {
  return ` ${question} `.includes(` ${phrase} `);
}

function findMatchingRidings(question, catalog, beginningYear, endingYear) {
  const normalizedQuestion = normalizeText(question);
  const compatibleBoundarySet = boundarySetForPeriod(beginningYear, endingYear);
  const matches = catalog
    .map((riding) => ({ ...riding, normalizedName: normalizeText(riding.name) }))
    .filter((riding) =>
      riding.normalizedName
      && !PROVINCE_NAMES.has(riding.normalizedName)
      && includesPhrase(normalizedQuestion, riding.normalizedName)
      && (!compatibleBoundarySet || riding.boundarySet === compatibleBoundarySet),
    )
    .sort((left, right) => right.normalizedName.length - left.normalizedName.length);

  const unique = [];
  const seen = new Set();
  for (const match of matches) {
    const key = `${match.normalizedName}|${match.provinceCode}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(match);
    }
  }
  return unique;
}

async function loadRidingCatalog() {
  if (!ridingCatalogPromise) {
    ridingCatalogPromise = Region.find({ level: "riding" })
      .select("code name provinceCode provinceName boundarySet")
      .lean()
      .exec();
  }
  return ridingCatalogPromise;
}

async function resolveRidingContext(question, beginningYear, endingYear) {
  const catalog = await loadRidingCatalog();
  const matches = findMatchingRidings(
    question,
    catalog,
    beginningYear,
    endingYear,
  );

  if (matches.length !== 1) {
    return {
      ambiguous: matches.length > 1,
      matches: matches.slice(0, 5).map((match) => ({
        name: match.name,
        provinceCode: match.provinceCode,
        boundarySet: match.boundarySet,
      })),
    };
  }

  return {
    ambiguous: false,
    name: matches[0].name,
    provinceCode: matches[0].provinceCode,
    boundarySet: matches[0].boundarySet,
    matches: [],
  };
}

module.exports = {
  boundarySetForPeriod,
  findMatchingRidings,
  normalizeText,
  resolveRidingContext,
};
