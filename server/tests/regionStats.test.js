const {
  calculateAverage,
  buildPrivacy,
  createRegionStat,
} = require("../src/scripts/buildRegionStats");

const nationalRegion = {
  level: "national",
  code: "CA",
  name: "Canada",
  provinceCode: "",
  boundarySet: "national_2024",
};

const ontarioRegion = {
  level: "province",
  code: "ON",
  name: "Ontario",
  provinceCode: "ON",
  boundarySet: "province_2024",
};

describe("RegionStat aggregation helpers", () => {
  describe("calculateAverage", () => {
    it("calculates average donation correctly", () => {
      expect(calculateAverage(1000, 4)).toBe(250);
      expect(calculateAverage(125.75, 2)).toBe(62.88);
    });

    it("returns 0 when donation count is 0", () => {
      expect(calculateAverage(1000, 0)).toBe(0);
      expect(calculateAverage(0, 0)).toBe(0);
    });
  });

  describe("buildPrivacy", () => {
    it("does not suppress records when donor count meets threshold", () => {
      const privacy = buildPrivacy(5);

      expect(privacy).toMatchObject({
        isSuppressed: false,
        suppressionThreshold: 5,
        suppressionReason: "",
      });

      expect(privacy.computedAt).toBeInstanceOf(Date);
    });

    it("suppresses records when donor count is below threshold", () => {
      const privacy = buildPrivacy(3);

      expect(privacy.isSuppressed).toBe(true);
      expect(privacy.suppressionThreshold).toBe(5);
      expect(privacy.suppressionReason).toContain(
        "below suppression threshold",
      );
      expect(privacy.computedAt).toBeInstanceOf(Date);
    });

    it("sets no-data message when donor count is 0", () => {
      const privacy = buildPrivacy(0);

      expect(privacy).toMatchObject({
        isSuppressed: true,
        suppressionReason: "No donation data available for this region.",
      });
    });
  });

  describe("createRegionStat", () => {
    it("creates a national RegionStat object with expected shape", () => {
      const totals = {
        totalDonations: 1000,
        donationCount: 4,
        donorCount: 4,
      };

      const partyStats = [
        {
          partyCode: "CPC",
          partyName: "Conservative Party of Canada",
          totalDonations: 600,
          donationCount: 2,
          donorCount: 2,
        },
        {
          partyCode: "LPC",
          partyName: "Liberal Party of Canada",
          totalDonations: 400,
          donationCount: 2,
          donorCount: 2,
        },
      ];

      const donationsTrend = [
        {
          year: 2024,
          totalDonations: 1000,
          donationCount: 4,
          donorCount: 4,
          perCapitaAmount: 0,
        },
      ];

      const regionStat = createRegionStat(
        nationalRegion,
        totals,
        partyStats,
        donationsTrend,
      );

      expect(regionStat.region).toEqual(nationalRegion);

      expect(regionStat.filters).toEqual({
        beginningYear: 2004,
        endingYear: 2024,
        partyCode: "ALL",
        metricMode: "total",
      });

      expect(regionStat.totals).toMatchObject({
        totalDonations: 1000,
        donationCount: 4,
        donorCount: 4,
        averageDonation: 250,
        perCapitaAmount: 0,
        population: 0,
      });

      expect(regionStat.partyStats).toHaveLength(2);
      expect(regionStat.partyStats[0].partyCode).toBe("CPC");

      expect(regionStat.donationsTrend).toHaveLength(1);
      expect(regionStat.donationsTrend[0].year).toBe(2024);

      expect(regionStat.privacy).toMatchObject({
        isSuppressed: true,
        suppressionThreshold: 5,
      });
    });

    it("creates a province RegionStat object with expected shape", () => {
      const totals = {
        totalDonations: 1500,
        donationCount: 5,
        donorCount: 5,
      };

      const regionStat = createRegionStat(ontarioRegion, totals, [], []);

      expect(regionStat.region).toEqual(ontarioRegion);

      expect(regionStat.totals).toMatchObject({
        totalDonations: 1500,
        averageDonation: 300,
      });

      expect(regionStat.privacy.isSuppressed).toBe(false);
    });
  });
});
