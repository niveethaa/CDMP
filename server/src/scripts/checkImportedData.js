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

    const politicalPartyCount = await PoliticalParty.countDocuments();
    const donationCount = await Donation.countDocuments();
    const importBatchCount = await ImportDataBatch.countDocuments();
    const regionCount = await Region.countDocuments();
    const regionStatCount = await RegionStat.countDocuments();

    console.log("\nCDMP MongoDB Data Check");
    console.log("=======================");
    console.log("Political parties:", politicalPartyCount);
    console.log("Donation records:", donationCount);
    console.log("Import batches:", importBatchCount);
    console.log("Regions:", regionCount);
    console.log("Region stats:", regionStatCount);

    const latestBatch = await ImportDataBatch.findOne()
      .sort({ updatedAt: -1 })
      .lean();

    console.log("\nLatest Import Batch");
    console.log("-------------------");

    if (!latestBatch) {
      console.log("No import batch found.");
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
        "source.fileName source.year donor.donorDisplayName donor.city donor.province party.code contribution.dateReceived contribution.amountTotal",
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

        const donorName = donor.donorDisplayName || "Unknown donor";
        const partyCode = party.code || "UNKNOWN";
        const amount = money(contribution.amountTotal);
        const date = dateOnly(contribution.dateReceived);
        const city = donor.city || "Unknown city";
        const province = donor.province || "Unknown province";
        const fileName = source.fileName || "Unknown file";

        console.log(
          `${i + 1}. ${donorName} | ${partyCode} | ${amount} | ${date} | ${city}, ${province} | ${fileName}`,
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
    ]);

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
