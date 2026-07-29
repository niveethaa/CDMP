const {
  combineRegionStatDocuments,
  redactSuppressedStats,
} = require("../src/services/regionStats.service");

function makeDoc(donorCount) {
  return {
    region: { level: "riding", code: "35001", name: "Test Riding" },
    filters: { beginningYear: 2024, endingYear: 2024 },
    totals: {
      totalDonations: donorCount * 300,
      donationCount: donorCount,
      donorCount,
      population: 1000,
    },
    partyStats: [
      {
        partyCode: "LPC",
        partyName: "Liberal",
        totalDonations: donorCount * 300,
        donationCount: donorCount,
        donorCount,
      },
    ],
    donationsTrend: [{ year: 2024, totalDonations: donorCount * 300 }],
  };
}

describe("regionStats.service serve-time suppression", () => {
  describe("combineRegionStatDocuments", () => {
    it("redacts sensitive figures when donor count is below threshold", () => {
      const result = combineRegionStatDocuments([makeDoc(3)]);

      expect(result.privacy.isSuppressed).toBe(true);
      expect(result.totals.totalDonations).toBeNull();
      expect(result.totals.donationCount).toBeNull();
      expect(result.totals.donorCount).toBeNull();
      expect(result.totals.averageDonation).toBeNull();
      expect(result.totals.perCapitaAmount).toBeNull();
      expect(result.partyStats).toHaveLength(0);
      expect(result.donationsTrend).toHaveLength(0);
      // Non-sensitive context is retained.
      expect(result.totals.population).toBe(1000);
      expect(result.region.code).toBe("35001");
    });

    it("returns real figures when donor count meets threshold", () => {
      const result = combineRegionStatDocuments([makeDoc(5)]);

      expect(result.privacy.isSuppressed).toBe(false);
      expect(result.totals.totalDonations).toBe(1500);
      expect(result.totals.donorCount).toBe(5);
      expect(result.partyStats.length).toBeGreaterThan(0);
      expect(result.donationsTrend.length).toBeGreaterThan(0);
    });
  });

  describe("redactSuppressedStats", () => {
    it("leaves non-suppressed results untouched", () => {
      const input = {
        totals: { totalDonations: 1000, donorCount: 10, population: 500 },
        partyStats: [{ partyCode: "CPC" }],
        donationsTrend: [{ year: 2024 }],
        privacy: { isSuppressed: false },
      };
      expect(redactSuppressedStats(input)).toBe(input);
    });

    it("withholds figures for suppressed results", () => {
      const input = {
        totals: { totalDonations: 400, donorCount: 2, population: 500 },
        partyStats: [{ partyCode: "CPC" }],
        donationsTrend: [{ year: 2024 }],
        privacy: { isSuppressed: true },
      };
      const result = redactSuppressedStats(input);

      expect(result.totals.totalDonations).toBeNull();
      expect(result.totals.donorCount).toBeNull();
      expect(result.totals.population).toBe(500);
      expect(result.partyStats).toHaveLength(0);
      expect(result.donationsTrend).toHaveLength(0);
    });
  });
});
