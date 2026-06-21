describe("CDMP Mongoose models", () => {
  it("loads all data models without errors", () => {
    expect(() => {
      require("../src/models/Donation");
      require("../src/models/ImportDataBatch");
      require("../src/models/PoliticalParty");
      require("../src/models/Region");
      require("../src/models/RegionStat");
    }).not.toThrow();
  });

  it("registers the expected model names", () => {
    const Donation = require("../src/models/Donation");
    const ImportDataBatch = require("../src/models/ImportDataBatch");
    const PoliticalParty = require("../src/models/PoliticalParty");
    const Region = require("../src/models/Region");
    const RegionStat = require("../src/models/RegionStat");

    expect(Donation.modelName).toBe("Donation");
    expect(ImportDataBatch.modelName).toBe("ImportDataBatch");
    expect(PoliticalParty.modelName).toBe("PoliticalParty");
    expect(Region.modelName).toBe("Region");
    expect(RegionStat.modelName).toBe("RegionStat");
  });

  it("includes core Donation schema paths", () => {
    const Donation = require("../src/models/Donation");

    expect(Donation.schema.path("source.fileName")).toBeDefined();
    expect(Donation.schema.path("source.year")).toBeDefined();
    expect(Donation.schema.path("donor.donorDisplayName")).toBeDefined();
    expect(Donation.schema.path("party.code")).toBeDefined();
    expect(Donation.schema.path("contribution.amountTotal")).toBeDefined();
    expect(Donation.schema.path("geography.ridingName")).toBeDefined();
    expect(Donation.schema.path("raw")).toBeDefined();
  });

  it("includes core RegionStat schema paths", () => {
    const RegionStat = require("../src/models/RegionStat");

    expect(RegionStat.schema.path("region.level")).toBeDefined();
    expect(RegionStat.schema.path("region.code")).toBeDefined();
    expect(RegionStat.schema.path("filters.beginningYear")).toBeDefined();
    expect(RegionStat.schema.path("filters.endingYear")).toBeDefined();
    expect(RegionStat.schema.path("filters.partyCode")).toBeDefined();
    expect(RegionStat.schema.path("totals.totalDonations")).toBeDefined();
    expect(RegionStat.schema.path("partyStats")).toBeDefined();
    expect(RegionStat.schema.path("donationsTrend")).toBeDefined();
    expect(RegionStat.schema.path("privacy.isSuppressed")).toBeDefined();
  });
});
