const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { parse } = require("csv-parse/sync");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

const connectDB = require("../config/db");
const Donation = require("../models/Donation");
const ImportDataBatch = require("../models/ImportDataBatch");

const parseAmount = require("../utils/parseAmount");
const parseDate = require("../utils/parseDate");
const normalizePostalCode = require("../utils/normalizePostalCode");
const normalizeParty = require("../utils/normalizeParty");

const PROJECT_ROOT = path.resolve(__dirname, "../../..");

const DEFAULT_DATA_ROOT = path.join(PROJECT_ROOT, "data", "donation", "raw");
const FALLBACK_DATA_ROOT = path.join(
  PROJECT_ROOT,
  "CDMP-data",
  "donation",
  "raw",
);

const INSERT_CHUNK_SIZE = 1000;

function getArgValue(flagName) {
  const index = process.argv.indexOf(flagName);

  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] || null;
}

function hasFlag(flagName) {
  return process.argv.includes(flagName);
}

function getDataRoot() {
  if (process.env.DONATION_DATA_DIR) {
    return path.resolve(process.env.DONATION_DATA_DIR);
  }

  if (fs.existsSync(DEFAULT_DATA_ROOT)) {
    return DEFAULT_DATA_ROOT;
  }

  if (fs.existsSync(FALLBACK_DATA_ROOT)) {
    return FALLBACK_DATA_ROOT;
  }

  return DEFAULT_DATA_ROOT;
}

function getFileInfo(filePath) {
  const fileName = path.basename(filePath);
  const match = fileName.match(/^([A-Za-z]+)(\d{4})\.csv$/);

  if (!match) {
    return {
      fileName: fileName,
      partyCode: "UNKNOWN",
      year: null,
    };
  }

  return {
    fileName: fileName,
    partyCode: match[1].toUpperCase(),
    year: Number(match[2]),
  };
}

function getAllCsvFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  const files = [];
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      const nestedFiles = getAllCsvFiles(fullPath);
      files.push(...nestedFiles);
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".csv")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function getFilesToImport() {
  const fileArg = getArgValue("--file");
  const importAll = hasFlag("--all");
  const dataRoot = getDataRoot();

  if (fileArg) {
    const resolvedFile = path.resolve(process.cwd(), fileArg);

    if (!fs.existsSync(resolvedFile)) {
      throw new Error(`CSV file not found: ${resolvedFile}`);
    }

    return [resolvedFile];
  }

  const allCsvFiles = getAllCsvFiles(dataRoot);
  const modernFiles = [];

  for (const filePath of allCsvFiles) {
    const fileInfo = getFileInfo(filePath);

    if (fileInfo.year >= 2004 && fileInfo.year <= 2024) {
      modernFiles.push(filePath);
    }
  }

  if (modernFiles.length === 0) {
    throw new Error(`No modern CSV files found under ${dataRoot}`);
  }

  if (importAll) {
    return modernFiles;
  }

  let sampleFile = modernFiles[0];

  for (const filePath of modernFiles) {
    if (path.basename(filePath) === "BQ2024.csv") {
      sampleFile = filePath;
      break;
    }
  }

  console.log("No --file or --all flag provided.");
  console.log(`Defaulting to one sample file: ${sampleFile}`);
  console.log("Use --all later to import all modern CSV files.");

  return [sampleFile];
}

function readModernDonationCsv(filePath) {
  const csvText = fs.readFileSync(filePath, "utf8");

  const rows = parse(csvText, {
    columns: true,
    from_line: 5,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
    relax_quotes: true,
  });

  return rows;
}

function cleanString(value) {
  return String(value || "").trim();
}

function buildPersonName(firstName, middleName, lastName) {
  const parts = [
    cleanString(firstName),
    cleanString(middleName),
    cleanString(lastName),
  ];

  return parts.filter(Boolean).join(" ");
}

function getPartyInfo(row, fileInfo) {
  const partyFromRow = normalizeParty(
    row.Politicial_party || row.Political_party,
  );

  const partyFromFile = normalizeParty(fileInfo.partyCode);

  let partyCode = fileInfo.partyCode;

  if (partyFromRow.code !== "UNKNOWN") {
    partyCode = partyFromRow.code;
  } else if (partyFromFile.code !== "UNKNOWN") {
    partyCode = partyFromFile.code;
  }

  let partyName = partyFromFile.name;

  if (partyFromRow.code !== "UNKNOWN") {
    partyName = partyFromRow.name;
  }

  return {
    code: partyCode,
    name: partyName,
  };
}

function buildDonationDocument(row, fileInfo, rowIndex, importDataBatchId) {
  const amountMonetary = parseAmount(row.Monetary);
  const amountNonMonetary = parseAmount(row.Non_monetary);
  const amountTotal = amountMonetary + amountNonMonetary;

  const postal = normalizePostalCode(row.Postal_code);
  const party = getPartyInfo(row, fileInfo);

  const donorDisplayName = buildPersonName(
    row.Contributor_first_name,
    row.Contributor_middle_initial,
    row.Contributor_last_name,
  );

  const recipientName = buildPersonName(
    row.Recipient_first_name,
    row.Recipient_middle_initial,
    row.Recipient_last_name,
  );

  return {
    source: {
      fileName: fileInfo.fileName,
      year: fileInfo.year,
      rowNumber: rowIndex + 6,
      partyCode: party.code,
      dataEra: "modern",
      importDataBatchId: importDataBatchId,
    },

    donor: {
      donorType: cleanString(row.Type_of_contributor),
      donorFirstName: cleanString(row.Contributor_first_name),
      donorLastName: cleanString(row.Contributor_last_name),
      donorMiddleName: cleanString(row.Contributor_middle_initial),
      donorDisplayName: donorDisplayName,
      city: cleanString(row.City),
      province: cleanString(row.Province),
      postalCode: postal.postalCode,
      fsa: postal.fsa,
    },

    party: {
      code: party.code,
      name: party.name,
    },

    recipient: {
      id: cleanString(row.Client_id),
      name: recipientName || cleanString(row.Recipient_last_name),
      politicalEntity: cleanString(row.Recipient_last_name),
      electoralDistrict: "",
      electoralEvent: cleanString(row.Fiscal_year_or_event_date),
    },

    contribution: {
      dateReceived: parseDate(row.Date_received),
      amountMonetary: amountMonetary,
      amountNonMonetary: amountNonMonetary,
      amountTotal: amountTotal,
    },

    geography: {
      provinceCode: cleanString(row.Province),
      provinceName: "",
      ridingCode: "",
      ridingName: "",
      boundarySet: "",
      geoCodeStatus: "not_attempted",
      latitude: undefined,
      longitude: undefined,
    },

    access: {
      individualRecordRestricted: true,
      publicAggregationAllowed: true,
    },

    raw: row,
  };
}

async function insertInChunks(documents) {
  let insertedCount = 0;

  for (let index = 0; index < documents.length; index += INSERT_CHUNK_SIZE) {
    const chunk = documents.slice(index, index + INSERT_CHUNK_SIZE);

    await Donation.insertMany(chunk, {
      ordered: false,
    });

    insertedCount += chunk.length;

    console.log(`Inserted ${insertedCount}/${documents.length}`);
  }

  return insertedCount;
}

async function importCsvFile(filePath) {
  const fileInfo = getFileInfo(filePath);

  if (!fileInfo.year) {
    throw new Error(
      `Could not determine year from file name: ${fileInfo.fileName}`,
    );
  }

  console.log(`\nImporting ${fileInfo.fileName}...`);

  let importBatch = await ImportDataBatch.findOneAndUpdate(
    { fileName: fileInfo.fileName },
    {
      $set: {
        fileName: fileInfo.fileName,
        source: filePath,
        year: fileInfo.year,
        partyCode: fileInfo.partyCode,
        dataEra: "modern",
        status: "processing",
        errorMessage: "",
      },
    },
    {
      upsert: true,
      new: true,
    },
  );

  try {
    const rows = readModernDonationCsv(filePath);

    const deleteResult = await Donation.deleteMany({
      "source.fileName": fileInfo.fileName,
    });

    if (deleteResult.deletedCount > 0) {
      console.log(
        `Removed ${deleteResult.deletedCount} existing records for ${fileInfo.fileName}.`,
      );
    }

    const validDocuments = [];
    let skippedCount = 0;

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];

      const document = buildDonationDocument(
        row,
        fileInfo,
        index,
        importBatch._id,
      );

      try {
        await new Donation(document).validate();
        validDocuments.push(document);
      } catch (validationError) {
        skippedCount += 1;

        if (skippedCount <= 5) {
          console.warn(
            `Skipping row ${index + 6} in ${fileInfo.fileName}: ${validationError.message}`,
          );
        }
      }
    }

    const importedCount = await insertInChunks(validDocuments);

    importBatch = await ImportDataBatch.findByIdAndUpdate(
      importBatch._id,
      {
        $set: {
          rowCount: rows.length,
          importedCount: importedCount,
          skippedCount: skippedCount,
          status: "completed",
          errorMessage: "",
        },
      },
      { new: true },
    );

    console.log(`Completed ${fileInfo.fileName}`);
    console.log(`Rows read: ${rows.length}`);
    console.log(`Imported: ${importedCount}`);
    console.log(`Skipped: ${skippedCount}`);

    return importBatch;
  } catch (error) {
    await ImportDataBatch.findByIdAndUpdate(importBatch._id, {
      $set: {
        status: "failed",
        errorMessage: error.message,
      },
    });

    throw error;
  }
}

async function main() {
  try {
    await connectDB();

    const filesToImport = getFilesToImport();

    console.log(`Files to import: ${filesToImport.length}`);

    for (const filePath of filesToImport) {
      await importCsvFile(filePath);
    }

    const donationCount = await Donation.countDocuments();
    const batchCount = await ImportDataBatch.countDocuments();

    console.log("\nImport run complete.");
    console.log(`Total Donation documents: ${donationCount}`);
    console.log(`Total ImportDataBatch documents: ${batchCount}`);
  } catch (error) {
    console.error("Donation import failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  getFileInfo,
  readModernDonationCsv,
  buildDonationDocument,
};
