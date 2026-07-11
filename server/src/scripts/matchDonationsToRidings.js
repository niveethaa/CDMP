const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const connectDB = require("../config/db");
const Donation = require("../models/Donation");
const BoundarySet = require("../models/BoundarySet");
const PostalRidingMapping = require("../models/PostalRidingMapping");
const DonationRidingAssignment = require("../models/DonationRidingAssignment");

const DONATION_BATCH_SIZE = 1000;
const BULK_WRITE_SIZE = 1000;

const DEFAULT_BEGINNING_YEAR = 1993;
const DEFAULT_ENDING_YEAR = 2024;

const NO_POSTAL_CODE_NOTE = "Donation has no postal code.";

function getArgValue(flagName) {
  const index = process.argv.indexOf(flagName);
  return index === -1 ? null : process.argv[index + 1] || null;
}

function hasFlag(flagName) {
  return process.argv.includes(flagName);
}

function getNumberArg(flagName) {
  const value = getArgValue(flagName);
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

function cleanString(value) {
  return String(value || "").trim();
}

function normalizePostalCode(value) {
  return cleanString(value)
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function resolveBoundarySetForYear(boundarySets, year) {
  const numericYear = Number(year);

  if (!Number.isInteger(numericYear)) return null;

  return (
    boundarySets.find(
      ({ validFromYear, validToYear }) =>
        numericYear >= validFromYear &&
        (validToYear == null || numericYear <= validToYear),
    ) || null
  );
}

function getDonationProvinceCode(donation) {
  return cleanString(
    donation.geography?.provinceCode || donation.donor?.province,
  ).toUpperCase();
}

function buildBaseMatchResult(donation, boundarySet, overrides = {}) {
  return {
    donationId: donation._id,
    donationYear: donation.source?.year,
    boundarySet: boundarySet?.code || "unresolved",
    ridingCode: "",
    ridingName: "",
    provinceCode: getDonationProvinceCode(donation),
    matchStatus: "unmatched",
    matchMethod: "none",
    confidence: "none",
    notes: "",
    ...overrides,
  };
}

function buildMatchResult({ donation, boundarySet, mapping }) {
  const donationYear = donation.source?.year;
  const postalCode = normalizePostalCode(donation.donor?.postalCode);

  if (!boundarySet) {
    return buildBaseMatchResult(donation, null, {
      notes: `No boundary set found for donation year ${donationYear}.`,
    });
  }

  if (!postalCode) {
    return buildBaseMatchResult(donation, boundarySet, {
      notes: NO_POSTAL_CODE_NOTE,
    });
  }

  if (!mapping) {
    return buildBaseMatchResult(donation, boundarySet, {
      notes: `No postal-riding mapping found for ${postalCode} under ${boundarySet.code}.`,
    });
  }

  const candidates = Array.isArray(mapping.candidates)
    ? mapping.candidates
    : [];

  if (candidates.length === 1) {
    const candidate = candidates[0];

    return buildBaseMatchResult(donation, boundarySet, {
      ridingCode: candidate.ridingCode || "",
      ridingName: candidate.ridingName || "",
      provinceCode: candidate.provinceCode || getDonationProvinceCode(donation),
      matchStatus: "matched",
      matchMethod: "postal_code",
      confidence: "high",
    });
  }

  if (candidates.length > 1) {
    return buildBaseMatchResult(donation, boundarySet, {
      matchStatus: "ambiguous",
      matchMethod: "postal_code",
      confidence: "low",
      notes: `Postal code maps to ${candidates.length} riding candidates.`,
    });
  }

  return buildBaseMatchResult(donation, boundarySet, {
    notes: "Postal-riding mapping exists but has no candidates.",
  });
}

function buildAssignmentBulkOperation(matchResult) {
  return {
    updateOne: {
      filter: {
        donationId: matchResult.donationId,
        boundarySet: matchResult.boundarySet,
      },
      update: { $set: matchResult },
      upsert: true,
    },
  };
}

function buildDonationGeographyBulkOperation({
  donationId,
  ridingCode,
  ridingName,
  boundarySet,
  matchStatus,
}) {
  return {
    updateOne: {
      filter: { _id: donationId },
      update: {
        $set: {
          "geography.ridingCode": ridingCode,
          "geography.ridingName": ridingName,
          "geography.boundarySet": boundarySet,
          "geography.geoCodeStatus": matchStatus,
        },
      },
    },
  };
}

function buildMappingLookupKey(boundarySetCode, postalCode) {
  return `${boundarySetCode}|${postalCode}`;
}

async function loadBoundarySets() {
  const boundarySets = await BoundarySet.find({ active: true })
    .sort({ validFromYear: 1 })
    .lean();

  if (!boundarySets.length) {
    throw new Error(
      "No active BoundarySet records found. Run npm run seed:boundary-sets first.",
    );
  }

  return boundarySets;
}

function addPostalCodeToLookup(
  postalCodesByBoundarySet,
  boundarySetCode,
  postalCode,
) {
  if (!postalCodesByBoundarySet.has(boundarySetCode)) {
    postalCodesByBoundarySet.set(boundarySetCode, new Set());
  }

  postalCodesByBoundarySet.get(boundarySetCode).add(postalCode);
}

async function loadMappingsForDonationBatch(donations, boundarySets) {
  const postalCodesByBoundarySet = new Map();

  for (const donation of donations) {
    const boundarySet = resolveBoundarySetForYear(
      boundarySets,
      donation.source?.year,
    );

    const postalCode = normalizePostalCode(donation.donor?.postalCode);

    if (boundarySet && postalCode) {
      addPostalCodeToLookup(
        postalCodesByBoundarySet,
        boundarySet.code,
        postalCode,
      );
    }
  }

  const mappingLookup = new Map();

  for (const [boundarySetCode, postalCodeSet] of postalCodesByBoundarySet) {
    const mappings = await PostalRidingMapping.find({
      boundarySet: boundarySetCode,
      postalCode: { $in: [...postalCodeSet] },
    })
      .select("postalCode boundarySet candidates candidateCount matchStatus")
      .lean();

    for (const mapping of mappings) {
      mappingLookup.set(
        buildMappingLookupKey(mapping.boundarySet, mapping.postalCode),
        mapping,
      );
    }
  }

  return mappingLookup;
}

async function flushBulkOperations(Model, operations) {
  if (!operations.length) return;

  await Model.bulkWrite(operations, { ordered: false });
  operations.length = 0;
}

function updateSummary(summary, matchResult) {
  summary.processed += 1;

  if (summary[matchResult.matchStatus] !== undefined) {
    summary[matchResult.matchStatus] += 1;
  }

  if (matchResult.notes === NO_POSTAL_CODE_NOTE) {
    summary.missingPostalCode += 1;
  }

  if (matchResult.boundarySet === "unresolved") {
    summary.unresolvedBoundarySet += 1;
  }
}

async function processDonationBatch(donations, boundarySets, summary) {
  const mappingLookup = await loadMappingsForDonationBatch(
    donations,
    boundarySets,
  );

  const assignmentOperations = [];
  const donationOperations = [];

  for (const donation of donations) {
    const boundarySet = resolveBoundarySetForYear(
      boundarySets,
      donation.source?.year,
    );

    const postalCode = normalizePostalCode(donation.donor?.postalCode);
    const mappingKey = boundarySet
      ? buildMappingLookupKey(boundarySet.code, postalCode)
      : null;

    const matchResult = buildMatchResult({
      donation,
      boundarySet,
      mapping: mappingKey ? mappingLookup.get(mappingKey) : null,
    });

    assignmentOperations.push(buildAssignmentBulkOperation(matchResult));
    donationOperations.push(buildDonationGeographyBulkOperation(matchResult));

    updateSummary(summary, matchResult);

    if (assignmentOperations.length >= BULK_WRITE_SIZE) {
      await flushBulkOperations(DonationRidingAssignment, assignmentOperations);
    }

    if (donationOperations.length >= BULK_WRITE_SIZE) {
      await flushBulkOperations(Donation, donationOperations);
    }
  }

  await flushBulkOperations(DonationRidingAssignment, assignmentOperations);
  await flushBulkOperations(Donation, donationOperations);
}

function buildDonationQuery() {
  const year = getNumberArg("--year");

  return year
    ? { "source.year": year }
    : {
        "source.year": {
          $gte: DEFAULT_BEGINNING_YEAR,
          $lte: DEFAULT_ENDING_YEAR,
        },
      };
}

function getRunLimit() {
  if (hasFlag("--all")) return null;
  return getNumberArg("--limit") || 10000;
}

function createSummary() {
  return {
    processed: 0,
    matched: 0,
    ambiguous: 0,
    unmatched: 0,
    missingPostalCode: 0,
    unresolvedBoundarySet: 0,
  };
}

function logFinalSummary(summary) {
  console.log("\nDonation riding matching complete.");
  console.log(`Processed: ${summary.processed}`);
  console.log(`Matched: ${summary.matched}`);
  console.log(`Ambiguous: ${summary.ambiguous}`);
  console.log(`Unmatched: ${summary.unmatched}`);
  console.log(`Missing postal code: ${summary.missingPostalCode}`);
  console.log(`Unresolved boundary set: ${summary.unresolvedBoundarySet}`);
}

async function matchDonationsToRidings() {
  try {
    await connectDB();

    const boundarySets = await loadBoundarySets();
    const donationQuery = buildDonationQuery();
    const limit = getRunLimit();

    console.log("Matching donations to federal ridings...");
    console.log(`Donation query: ${JSON.stringify(donationQuery)}`);

    if (limit) {
      console.log(`Processing limit: ${limit}`);
      console.log("Use --all to process all matching donations.");
    } else {
      console.log("Processing all matching donations.");
    }

    let query = Donation.find(donationQuery)
      .sort({ _id: 1 })
      .select(
        "_id source.year donor.postalCode donor.province geography.provinceCode",
      )
      .lean();

    if (limit) {
      query = query.limit(limit);
    }

    const cursor = query.cursor({ batchSize: DONATION_BATCH_SIZE });
    const summary = createSummary();

    let batch = [];

    for await (const donation of cursor) {
      batch.push(donation);

      if (batch.length < DONATION_BATCH_SIZE) continue;

      await processDonationBatch(batch, boundarySets, summary);
      batch = [];

      if (summary.processed % 10000 === 0) {
        console.log(`Processed ${summary.processed} donations...`);
      }
    }

    if (batch.length) {
      await processDonationBatch(batch, boundarySets, summary);
    }

    logFinalSummary(summary);
  } catch (error) {
    console.error("Donation riding matching failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  matchDonationsToRidings();
}

module.exports = {
  normalizePostalCode,
  resolveBoundarySetForYear,
  buildMatchResult,
  buildAssignmentBulkOperation,
  buildDonationGeographyBulkOperation,
  matchDonationsToRidings,
};
