const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

const connectDB = require("../config/db");
const Donation = require("../models/Donation");
const ImportDataBatch = require("../models/ImportDataBatch");
const PoliticalParty = require("../models/PoliticalParty");
const Region = require("../models/Region");
const RegionStat = require("../models/RegionStat");
const BoundarySet = require("../models/BoundarySet");
const PostalRidingMapping = require("../models/PostalRidingMapping");
const DonationRidingAssignment = require("../models/DonationRidingAssignment");
const ReferenceDataBatch = require("../models/ReferenceDataBatch");

function money(value) {
  return "$" + Number(value || 0).toFixed(2);
}

function dateOnly(value) {
  if (!value) return "No date";
  return new Date(value).toISOString().slice(0, 10);
}

async function checkImportedData() {
  try {
    await connectDB();

    const [
      politicalPartyCount,
      donationCount,
      importBatchCount,
      regionCount,
      ridingRegionCount,
      regionStatCount,
      boundarySetCount,
      postalRidingMappingCount,
      donationRidingAssignmentCount,
      referenceDataBatchCount,
    ] = await Promise.all([
      PoliticalParty.countDocuments(),
      Donation.countDocuments(),
      ImportDataBatch.countDocuments(),
      Region.countDocuments(),
      Region.countDocuments({ level: "riding" }),
      RegionStat.countDocuments(),
      BoundarySet.countDocuments(),
      PostalRidingMapping.countDocuments(),
      DonationRidingAssignment.countDocuments(),
      ReferenceDataBatch.countDocuments(),
    ]);

    console.log("\nCDMP MongoDB Data Check");
    console.log("=======================");
    console.log("Political parties:", politicalPartyCount);
    console.log("Donation records:", donationCount);
    console.log("Import batches:", importBatchCount);
    console.log("Regions:", regionCount);
    console.log("Riding regions:", ridingRegionCount);
    console.log("Region stats:", regionStatCount);
    console.log("Boundary sets:", boundarySetCount);
    console.log("Postal-riding mappings:", postalRidingMappingCount);
    console.log("Donation riding assignments:", donationRidingAssignmentCount);
    console.log("Reference data batches:", referenceDataBatchCount);

    const donationEraSummary = await Donation.aggregate([
      {
        $group: {
          _id: "$source.dataEra",
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
    ]);

    console.log("\nDonation Records by Data Era");
    console.log("----------------------------");

    if (donationEraSummary.length === 0) {
      console.log("No donation records found.");
    } else {
      for (const item of donationEraSummary) {
        console.log(`${item._id || "unknown"}: ${item.count}`);
      }
    }

    const boundarySets = await BoundarySet.find()
      .sort({ validFromYear: 1 })
      .select("code name validFromYear validToYear active")
      .lean();

    console.log("\nBoundary Sets");
    console.log("-------------");

    if (boundarySets.length === 0) {
      console.log("No boundary sets found.");
    } else {
      for (const boundarySet of boundarySets) {
        const validToYear = boundarySet.validToYear || "present";

        console.log(
          `${boundarySet.code}: ${boundarySet.validFromYear}-${validToYear} | ${
            boundarySet.active ? "active" : "inactive"
          }`,
        );
      }
    }

    const ridingRegionSummary = await Region.aggregate([
      {
        $match: {
          level: "riding",
        },
      },
      {
        $group: {
          _id: "$boundarySet",
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
    ]);

    console.log("\nRiding Regions by Boundary Set");
    console.log("------------------------------");

    if (ridingRegionSummary.length === 0) {
      console.log("No riding regions found.");
    } else {
      for (const item of ridingRegionSummary) {
        console.log(`${item._id || "unknown"}: ${item.count}`);
      }
    }

    const mappingStatusSummary = await PostalRidingMapping.aggregate([
      {
        $group: {
          _id: {
            boundarySet: "$boundarySet",
            matchStatus: "$matchStatus",
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          "_id.boundarySet": 1,
          "_id.matchStatus": 1,
        },
      },
    ]).allowDiskUse(true);

    console.log("\nPostal-Riding Mapping Status");
    console.log("----------------------------");

    if (mappingStatusSummary.length === 0) {
      console.log("No postal-riding mappings found.");
    } else {
      for (const item of mappingStatusSummary) {
        const boundarySet = item._id?.boundarySet || "unknown";
        const matchStatus = item._id?.matchStatus || "unknown";

        console.log(`${boundarySet} | ${matchStatus}: ${item.count}`);
      }
    }

    const ridingAssignmentSummary = await DonationRidingAssignment.aggregate([
      {
        $group: {
          _id: "$matchStatus",
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          count: -1,
        },
      },
    ]);

    console.log("\nDonation Riding Assignment Summary");
    console.log("----------------------------------");

    if (ridingAssignmentSummary.length === 0) {
      console.log("No riding assignments found.");
    } else {
      for (const item of ridingAssignmentSummary) {
        console.log(`${item._id || "unknown"}: ${item.count}`);
      }
    }

    const referenceBatchSummary = await ReferenceDataBatch.find()
      .sort({ updatedAt: -1 })
      .limit(10)
      .select(
        "fileName referenceType boundarySet status rowCount importedCount skippedCount errorMessage",
      )
      .lean();

    console.log("\nLatest Reference Data Batches");
    console.log("-----------------------------");

    if (referenceBatchSummary.length === 0) {
      console.log("No reference data batches found.");
    } else {
      for (const batch of referenceBatchSummary) {
        console.log(
          `${batch.fileName} | ${batch.referenceType} | ${
            batch.boundarySet || "no boundary set"
          } | ${batch.status} | rows: ${batch.rowCount} | imported: ${
            batch.importedCount
          } | skipped: ${batch.skippedCount}`,
        );

        if (batch.errorMessage) {
          console.log(`  Error: ${batch.errorMessage}`);
        }
      }
    }

    const latestBatch = await ImportDataBatch.findOne()
      .sort({ updatedAt: -1 })
      .lean();

    console.log("\nLatest Donation Import Batch");
    console.log("----------------------------");

    if (!latestBatch) {
      console.log("No donation import batch found.");
    } else {
      console.log("File:", latestBatch.fileName);
      console.log("Year:", latestBatch.year);
      console.log("Party:", latestBatch.partyCode);
      console.log("Status:", latestBatch.status);
      console.log("Rows read:", latestBatch.rowCount);
      console.log("Imported:", latestBatch.importedCount);
      console.log("Skipped:", latestBatch.skippedCount);

      if (latestBatch.errorMessage) {
        console.log("Error:", latestBatch.errorMessage);
      }
    }

    const sampleDonations = await Donation.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select(
        "source.fileName source.year donor.donorDisplayName donor.city donor.province party.code contribution.dateReceived contribution.amountTotal geography.ridingCode geography.ridingName geography.geoCodeStatus geography.boundarySet",
      )
      .lean();

    console.log("\nSample Donations");
    console.log("----------------");

    if (sampleDonations.length === 0) {
      console.log("No donation records found.");
    } else {
      for (let i = 0; i < sampleDonations.length; i++) {
        const donation = sampleDonations[i];

        const donor = donation.donor || {};
        const party = donation.party || {};
        const contribution = donation.contribution || {};
        const source = donation.source || {};
        const geography = donation.geography || {};

        const donorName = donor.donorDisplayName || "Unknown donor";
        const partyCode = party.code || "UNKNOWN";
        const amount = money(contribution.amountTotal);
        const date = dateOnly(contribution.dateReceived);
        const city = donor.city || "Unknown city";
        const province = donor.province || "Unknown province";
        const fileName = source.fileName || "Unknown file";
        const ridingName = geography.ridingName || "No riding";
        const geoCodeStatus = geography.geoCodeStatus || "not_attempted";

        console.log(
          `${i + 1}. ${donorName} | ${partyCode} | ${amount} | ${date} | ${city}, ${province} | ${ridingName} | ${geoCodeStatus} | ${fileName}`,
        );
      }
    }

    const partySummary = await Donation.aggregate([
      {
        $group: {
          _id: "$party.code",
          donationCount: { $sum: 1 },
          totalDonations: { $sum: "$contribution.amountTotal" },
        },
      },
      {
        $sort: {
          donationCount: -1,
        },
      },
      {
        $limit: 10,
      },
    ]).allowDiskUse(true);

    console.log("\nDonation Summary by Party");
    console.log("-------------------------");

    if (partySummary.length === 0) {
      console.log("No party donation summary available.");
    } else {
      for (const party of partySummary) {
        const partyCode = party._id || "UNKNOWN";

        console.log(
          `${partyCode}: ${party.donationCount} donations | ${money(
            party.totalDonations,
          )}`,
        );
      }
    }

    console.log("\nData check complete.\n");
  } catch (error) {
    console.error("Data check failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

checkImportedData();
