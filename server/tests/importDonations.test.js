const fs = require("fs");
const os = require("os");
const path = require("path");

const Donation = require("../src/models/Donation");

const {
  getFileInfo,
  readModernDonationCsv,
  buildDonationDocument,
} = require("../src/scripts/importDonations");

const sampleRow = {
  Contributor_first_name: "Jane",
  Contributor_middle_initial: "Q",
  Contributor_last_name: "Doe",
  City: "Toronto",
  Province: "ON",
  Postal_code: "M1A 1A1",
  Politicial_party: "Bloc Québécois",
  Recipient_first_name: "Bloc",
  Recipient_middle_initial: "",
  Recipient_last_name: "Québécois",
  Client_id: "123",
  Fiscal_year_or_event_date: "2024",
  Date_received: "12-Jan-24",
  Monetary: "100.50",
  Non_monetary: "25.25",
  Type_of_contributor: "Individual",
};

const sampleFileInfo = {
  fileName: "BQ2024.csv",
  partyCode: "BQ",
  year: 2024,
};

describe("importDonations script", () => {
  it("extracts party code and year from a modern CSV filename", () => {
    const fileInfo = getFileInfo("/some/path/BQ2024.csv");

    expect(fileInfo).toEqual({
      fileName: "BQ2024.csv",
      partyCode: "BQ",
      year: 2024,
    });
  });

  it("returns UNKNOWN values when filename does not match expected pattern", () => {
    const fileInfo = getFileInfo("/some/path/random-file.csv");

    expect(fileInfo).toEqual({
      fileName: "random-file.csv",
      partyCode: "UNKNOWN",
      year: null,
    });
  });

  it("reads a modern donation CSV and skips the 4-line preamble", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cdmp-import-test-"));
    const tempCsvPath = path.join(tempDir, "BQ2024.csv");

    const csvContent = [
      "Preamble line 1",
      "Preamble line 2",
      "Preamble line 3",
      "Preamble line 4",
      "Contributor_first_name,Contributor_middle_initial,Contributor_last_name,City,Province,Postal_code,Politicial_party,Recipient_first_name,Recipient_middle_initial,Recipient_last_name,Client_id,Fiscal_year_or_event_date,Date_received,Monetary,Non_monetary,Type_of_contributor",
      "Jane,Q,Doe,Toronto,ON,M1A 1A1,Bloc Québécois,Bloc,,Québécois,123,2024,12-Jan-24,100.50,25.25,Individual",
    ].join("\n");

    fs.writeFileSync(tempCsvPath, csvContent);

    const rows = readModernDonationCsv(tempCsvPath);

    expect(rows).toHaveLength(1);
    expect(rows[0].Contributor_first_name).toBe("Jane");
    expect(rows[0].Contributor_last_name).toBe("Doe");
    expect(rows[0].Monetary).toBe("100.50");
    expect(rows[0].Non_monetary).toBe("25.25");

    fs.rmSync(tempDir, {
      recursive: true,
      force: true,
    });
  });

  it("maps a CSV row into a valid Donation document", async () => {
    const fakeImportBatchId = "507f1f77bcf86cd799439011";

    const document = buildDonationDocument(
      sampleRow,
      sampleFileInfo,
      0,
      fakeImportBatchId,
    );

    expect(document.source).toMatchObject({
      fileName: "BQ2024.csv",
      year: 2024,
      rowNumber: 6,
      dataEra: "modern",
    });

    expect(document.donor).toMatchObject({
      donorFirstName: "Jane",
      donorMiddleName: "Q",
      donorLastName: "Doe",
      donorDisplayName: "Jane Q Doe",
      city: "Toronto",
      province: "ON",
      postalCode: "M1A1A1",
      fsa: "M1A",
    });

    expect(document.party).toMatchObject({
      code: "BQ",
      name: "Bloc Québécois",
    });

    expect(document.contribution).toMatchObject({
      amountMonetary: 100.5,
      amountNonMonetary: 25.25,
      amountTotal: 125.75,
    });

    expect(document.geography).toMatchObject({
      provinceCode: "ON",
      geoCodeStatus: "not_attempted",
    });

    await new Donation(document).validate();
  });
});
