const Donation = require("../src/models/Donation");
const ImportDataBatch = require("../src/models/ImportDataBatch");
const PoliticalParty = require("../src/models/PoliticalParty");
const Region = require("../src/models/Region");
const RegionStat = require("../src/models/RegionStat");
const BoundarySet = require("../src/models/BoundarySet");
const PostalRidingMapping = require("../src/models/PostalRidingMapping");
const DonationRidingAssignment = require("../src/models/DonationRidingAssignment");
const ReferenceDataBatch = require("../src/models/ReferenceDataBatch");

describe("CDMP Mongoose models", () => {
  it("loads all data models without errors", () => {
    expect(() => {
      require("../src/models/Donation");
      require("../src/models/ImportDataBatch");
      require("../src/models/PoliticalParty");
      require("../src/models/Region");
      require("../src/models/RegionStat");
      require("../src/models/BoundarySet");
      require("../src/models/PostalRidingMapping");
      require("../src/models/DonationRidingAssignment");
      require("../src/models/ReferenceDataBatch");
    }).not.toThrow();
  });

  it("registers the expected model names", () => {
    expect(Donation.modelName).toBe("Donation");
    expect(ImportDataBatch.modelName).toBe("ImportDataBatch");
    expect(PoliticalParty.modelName).toBe("PoliticalParty");
    expect(Region.modelName).toBe("Region");
    expect(RegionStat.modelName).toBe("RegionStat");
    expect(BoundarySet.modelName).toBe("BoundarySet");
    expect(PostalRidingMapping.modelName).toBe("PostalRidingMapping");
    expect(DonationRidingAssignment.modelName).toBe("DonationRidingAssignment");
    expect(ReferenceDataBatch.modelName).toBe("ReferenceDataBatch");
  });

  it("includes core Donation schema paths", () => {
    expect(Donation.schema.path("source.fileName")).toBeDefined();
    expect(Donation.schema.path("source.year")).toBeDefined();
    expect(Donation.schema.path("donor.donorDisplayName")).toBeDefined();
    expect(Donation.schema.path("party.code")).toBeDefined();
    expect(Donation.schema.path("contribution.amountTotal")).toBeDefined();
    expect(Donation.schema.path("geography.ridingName")).toBeDefined();
    expect(Donation.schema.path("raw")).toBeDefined();
  });

  it("includes core RegionStat schema paths", () => {
    expect(RegionStat.schema.path("region.level")).toBeDefined();
    expect(RegionStat.schema.path("region.code")).toBeDefined();
    expect(RegionStat.schema.path("region.boundarySet")).toBeDefined();
    expect(RegionStat.schema.path("filters.beginningYear")).toBeDefined();
    expect(RegionStat.schema.path("filters.endingYear")).toBeDefined();
    expect(RegionStat.schema.path("filters.partyCode")).toBeDefined();
    expect(RegionStat.schema.path("totals.totalDonations")).toBeDefined();
    expect(RegionStat.schema.path("partyStats")).toBeDefined();
    expect(RegionStat.schema.path("donationsTrend")).toBeDefined();
    expect(RegionStat.schema.path("privacy.isSuppressed")).toBeDefined();
  });

  it("includes core timeline-ready riding schema paths", () => {
    expect(BoundarySet.schema.path("code")).toBeDefined();
    expect(BoundarySet.schema.path("name")).toBeDefined();
    expect(BoundarySet.schema.path("validFromYear")).toBeDefined();
    expect(BoundarySet.schema.path("validToYear")).toBeDefined();
    expect(BoundarySet.schema.path("active")).toBeDefined();

    expect(PostalRidingMapping.schema.path("postalCode")).toBeDefined();
    expect(PostalRidingMapping.schema.path("fsa")).toBeDefined();
    expect(PostalRidingMapping.schema.path("provinceCode")).toBeDefined();
    expect(PostalRidingMapping.schema.path("boundarySet")).toBeDefined();
    expect(PostalRidingMapping.schema.path("candidates")).toBeDefined();
    expect(PostalRidingMapping.schema.path("candidateCount")).toBeDefined();
    expect(PostalRidingMapping.schema.path("matchStatus")).toBeDefined();

    expect(DonationRidingAssignment.schema.path("donationId")).toBeDefined();
    expect(DonationRidingAssignment.schema.path("donationYear")).toBeDefined();
    expect(DonationRidingAssignment.schema.path("boundarySet")).toBeDefined();
    expect(DonationRidingAssignment.schema.path("ridingCode")).toBeDefined();
    expect(DonationRidingAssignment.schema.path("ridingName")).toBeDefined();
    expect(DonationRidingAssignment.schema.path("matchStatus")).toBeDefined();
    expect(DonationRidingAssignment.schema.path("matchMethod")).toBeDefined();
    expect(DonationRidingAssignment.schema.path("confidence")).toBeDefined();

    expect(ReferenceDataBatch.schema.path("fileName")).toBeDefined();
    expect(ReferenceDataBatch.schema.path("referenceType")).toBeDefined();
    expect(ReferenceDataBatch.schema.path("boundarySet")).toBeDefined();
    expect(ReferenceDataBatch.schema.path("status")).toBeDefined();
  });

  it("supports boundarySet-based Region and RegionStat indexes", () => {
    const regionIndexes = Region.schema.indexes();
    const regionStatIndexes = RegionStat.schema.indexes();

    const hasRegionBoundaryIndex = regionIndexes.some(([fields, options]) => {
      return (
        fields.level === 1 &&
        fields.code === 1 &&
        fields.boundarySet === 1 &&
        options.unique === true
      );
    });

    const hasRegionStatBoundaryIndex = regionStatIndexes.some(
      ([fields, options]) => {
        return (
          fields["region.level"] === 1 &&
          fields["region.code"] === 1 &&
          fields["region.boundarySet"] === 1 &&
          fields["filters.beginningYear"] === 1 &&
          fields["filters.endingYear"] === 1 &&
          fields["filters.partyCode"] === 1 &&
          fields["filters.metricMode"] === 1 &&
          options.unique === true
        );
      },
    );

    expect(hasRegionBoundaryIndex).toBe(true);
    expect(hasRegionStatBoundaryIndex).toBe(true);
  });
});
