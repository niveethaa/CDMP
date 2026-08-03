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

const MODERN_BEGINNING_YEAR = 2004;
const MODERN_ENDING_YEAR = 2024;

const PRE_2004_FILE_INFO = {
  "candidate_pre_2000_contributors_e.csv": {
    year: 1993,
    partyCode: "MULTI",
    dataEra: "pre_2004",
    canonical: true,
  },
  "candidate_2000_2004_contributors_audt_e.csv": {
    year: 2000,
    partyCode: "MULTI",
    dataEra: "pre_2004",
    canonical: false,
  },
  "candidate_2000_2004_contributors_audt_e_utf8.csv": {
    year: 2000,
    partyCode: "MULTI",
    dataEra: "pre_2004",
    canonical: true,
  },
  "party_annual_2000-2004_contributors_e.csv": {
    year: 2001,
    partyCode: "MULTI",
    dataEra: "pre_2004",
    canonical: false,
  },
  "party_annual_2000-2004_contributors_e_utf8.csv": {
    year: 2001,
    partyCode: "MULTI",
    dataEra: "pre_2004",
    canonical: true,
  },
};

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
  const pre2004Info = PRE_2004_FILE_INFO[fileName];

  if (pre2004Info) {
    return {
      fileName,
      ...pre2004Info,
    };
  }

  const match = fileName.match(/^([A-Za-z]+)(\d{4})\.csv$/);

  if (!match) {
    return {
      fileName: fileName,
      partyCode: "UNKNOWN",
      year: null,
      dataEra: "unknown",
    };
  }

  return {
    fileName: fileName,
    partyCode: match[1].toUpperCase(),
    year: Number(match[2]),
    dataEra: "modern",
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
  const donationFiles = [];

  for (const filePath of allCsvFiles) {
    const fileInfo = getFileInfo(filePath);

    if (
      fileInfo.dataEra === "modern" &&
      fileInfo.year >= MODERN_BEGINNING_YEAR &&
      fileInfo.year <= MODERN_ENDING_YEAR
    ) {
      donationFiles.push(filePath);
    }

    if (fileInfo.dataEra === "pre_2004" && fileInfo.canonical) {
      donationFiles.push(filePath);
    }
  }

  if (donationFiles.length === 0) {
    throw new Error(`No donation CSV files found under ${dataRoot}`);
  }

  if (importAll) {
    return donationFiles;
  }

  let sampleFile = donationFiles[0];

  for (const filePath of donationFiles) {
    if (path.basename(filePath) === "BQ2024.csv") {
      sampleFile = filePath;
      break;
    }
  }

  console.log("No --file or --all flag provided.");
  console.log(`Defaulting to one sample file: ${sampleFile}`);
  console.log("Use --all later to import all donation CSV files.");

  return [sampleFile];
}

function readCsvText(filePath) {
  const buffer = fs.readFileSync(filePath);
  const utf8Text = buffer.toString("utf8");

  if (utf8Text.includes("\uFFFD")) {
    return buffer.toString("latin1");
  }

  return utf8Text;
}

function readModernDonationCsv(filePath) {
  const csvText = readCsvText(filePath);

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

function normalizeRowKeys(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.trim(), value]),
  );
}

function readPre2004DonationCsv(filePath) {
  const csvText = readCsvText(filePath);

  return parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
    relax_quotes: true,
  }).map(normalizeRowKeys);
}

function cleanString(value) {
  return String(value || "").trim();
}

function normalizeProvinceCode(value) {
  const normalized = cleanString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

  const aliases = {
    ALBERTA: "AB",
    BC: "BC",
    BRITISHCOLUMBIA: "BC",
    MANITOBA: "MB",
    NEWBRUNSWICK: "NB",
    NEWFOUNDLAND: "NL",
    NEWFOUNDLANDANDLABRADOR: "NL",
    NF: "NL",
    NFLD: "NL",
    NOVASCOTIA: "NS",
    NWT: "NT",
    NORTHWESTTERRITORIES: "NT",
    NUNAVUT: "NU",
    NV: "NU",
    ONT: "ON",
    ONTARIO: "ON",
    PEI: "PE",
    PRINCEEDWARDISLAND: "PE",
    PQ: "QC",
    QUE: "QC",
    QUEBEC: "QC",
    SASKATCHEWAN: "SK",
    YK: "YT",
    YUKON: "YT",
  };

  return aliases[normalized] || normalized;
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
  const provinceCode = normalizeProvinceCode(row.Province);
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
      province: provinceCode,
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
      provinceCode: provinceCode,
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

function getPre2004Year(row, fileInfo) {
  const fiscalDate = cleanString(row["Fiscal date"]);
  const match = fiscalDate.match(/^(\d{4})/);

  if (match) {
    return Number(match[1]);
  }

  return fileInfo.year;
}

function getPre2004Party(row) {
  const normalizedParty = normalizeParty(row["Political Party"]);

  return {
    code: normalizedParty.code,
    name: normalizedParty.name || "Unknown Party",
  };
}

function buildPre2004DonationDocument(
  row,
  fileInfo,
  rowIndex,
  importDataBatchId,
) {
  const amountMonetary = parseAmount(row["Monetary amount"]);
  const amountNonMonetary = parseAmount(row["Non-Monetary amount"]);
  const amountTotal = amountMonetary + amountNonMonetary;
  const postal = normalizePostalCode(row["Contributor Postal code"]);
  const provinceCode = normalizeProvinceCode(row["Contributor Province"]);
  const party = getPre2004Party(row);

  const donorDisplayName =
    buildPersonName(
      row["Contributor first name"],
      "",
      row["Contributor last name"],
    ) || cleanString(row["Contributor name"]);

  const recipientName =
    buildPersonName(
      row["Recipient first name"],
      row["Recipient middle initial"],
      row["Recipient last name"],
    ) || cleanString(row.Recipient);

  return {
    source: {
      fileName: fileInfo.fileName,
      year: getPre2004Year(row, fileInfo),
      rowNumber: rowIndex + 2,
      partyCode: party.code,
      dataEra: "pre_2004",
      importDataBatchId: importDataBatchId,
    },

    donor: {
      donorType: cleanString(row["Contributor type"]),
      donorFirstName: cleanString(row["Contributor first name"]),
      donorLastName: cleanString(row["Contributor last name"]),
      donorMiddleName: "",
      donorDisplayName,
      city: cleanString(row["Contributor City"]),
      province: provinceCode,
      postalCode: postal.postalCode,
      fsa: postal.fsa,
    },

    party: {
      code: party.code,
      name: party.name,
    },

    recipient: {
      id: cleanString(row["Recipient ID"]),
      name: recipientName,
      politicalEntity: cleanString(row["Political Entity"]),
      electoralDistrict: cleanString(row["Electoral District"]),
      electoralEvent: cleanString(row["Electoral event"]),
    },

    contribution: {
      dateReceived: parseDate(row["Fiscal date"]),
      amountMonetary,
      amountNonMonetary,
      amountTotal,
    },

    geography: {
      provinceCode,
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
  const dataEra = fileInfo.dataEra || "modern";

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
        dataEra,
        status: "processing",
        errorMessage: "",
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    },
  );

  try {
    const rows =
      dataEra === "pre_2004"
        ? readPre2004DonationCsv(filePath)
        : readModernDonationCsv(filePath);

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

      const document =
        dataEra === "pre_2004"
          ? buildPre2004DonationDocument(
              row,
              fileInfo,
              index,
              importBatch._id,
            )
          : buildDonationDocument(row, fileInfo, index, importBatch._id);

      try {
        await new Donation(document).validate();
        validDocuments.push(document);
      } catch (validationError) {
        skippedCount += 1;

        if (skippedCount <= 5) {
          console.warn(
            `Skipping row ${document.source.rowNumber} in ${fileInfo.fileName}: ${validationError.message}`,
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
      { returnDocument: "after" },
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
  getFilesToImport,
  readModernDonationCsv,
  readPre2004DonationCsv,
  buildDonationDocument,
  buildPre2004DonationDocument,
  normalizeProvinceCode,
};
