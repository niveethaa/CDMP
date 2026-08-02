jest.mock("../src/services/regionStats.service", () => ({
  getAllProvinceStats: jest.fn(),
  getNationalStats: jest.fn(),
  getRegionStats: jest.fn(),
  getRidingStatsForProvince: jest.fn(),
}));

const regionStats = require("../src/services/regionStats.service");
const {
  executeQuerySpec,
} = require("../src/services/askDataExecutor.service");
const {
  QuerySpecValidationError,
} = require("../src/services/querySpec.service");

function stats({
  level = "province",
  code = "ON",
  name = "Ontario",
  totalDonations = 1000,
  donationCount = 10,
  donorCount = 8,
  suppressed = false,
} = {}) {
  return {
    region: { level, code, name },
    totals: {
      totalDonations,
      donationCount,
      donorCount,
      averageDonation: donationCount ? totalDonations / donationCount : 0,
      perCapitaAmount: 2,
      population: 500,
    },
    partyStats: [],
    donationsTrend: [],
    privacy: {
      isSuppressed: suppressed,
      suppressionReason: suppressed ? "Below threshold." : "",
    },
  };
}

function summaryQuery(overrides = {}) {
  return {
    intent: "summary",
    metric: "totalDonations",
    groupBy: null,
    partyCodes: ["LPC"],
    regionLevel: "province",
    regionCode: "ON",
    beginningYear: 2020,
    endingYear: 2024,
    boundarySet: null,
    limit: 5,
    ...overrides,
  };
}

describe("Ask Data QuerySpec executor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("executes a summary using aggregate region stats", async () => {
    regionStats.getRegionStats.mockResolvedValue(stats());

    const result = await executeQuerySpec(summaryQuery());

    expect(regionStats.getRegionStats).toHaveBeenCalledWith(
      "province",
      "ON",
      expect.objectContaining({
        partyCode: "LPC",
        beginningYear: 2020,
        endingYear: 2024,
      }),
    );
    expect(result).toMatchObject({
      columns: ["label", "totalDonations"],
      rows: [{ label: "Ontario", value: 1000, suppressed: false }],
      coverage: { beginningYear: 1993, endingYear: 2024 },
    });
  });

  it("sorts province rankings and applies the requested limit", async () => {
    regionStats.getAllProvinceStats.mockResolvedValue([
      stats({ code: "QC", name: "Quebec", totalDonations: 500 }),
      stats({ code: "ON", name: "Ontario", totalDonations: 2000 }),
      stats({ code: "AB", name: "Alberta", totalDonations: 1000 }),
    ]);

    const result = await executeQuerySpec({
      ...summaryQuery(),
      intent: "ranking",
      groupBy: "province",
      partyCodes: [],
      limit: 2,
    });

    expect(result.rows.map((row) => row.label)).toEqual([
      "Ontario",
      "Alberta",
    ]);
  });

  it("returns annual trend rows", async () => {
    regionStats.getNationalStats.mockResolvedValue({
      ...stats({ level: "national", code: "CA", name: "Canada" }),
      donationsTrend: [
        {
          year: 2020,
          totalDonations: 400,
          donationCount: 10,
          donorCount: 8,
        },
        {
          year: 2021,
          totalDonations: 600,
          donationCount: 12,
          donorCount: 9,
        },
      ],
    });

    const result = await executeQuerySpec({
      intent: "trend",
      metric: "totalDonations",
      groupBy: "year",
      partyCodes: ["CPC"],
      regionLevel: "national",
      beginningYear: 2020,
      endingYear: 2021,
      limit: 5,
    });

    expect(result.rows).toEqual([
      expect.objectContaining({ label: "2020", value: 400 }),
      expect.objectContaining({ label: "2021", value: 600 }),
    ]);
  });

  it("compares multiple parties using separately filtered aggregates", async () => {
    regionStats.getRegionStats
      .mockResolvedValueOnce(stats({ totalDonations: 900 }))
      .mockResolvedValueOnce(stats({ totalDonations: 700 }))
      .mockResolvedValueOnce(stats({ totalDonations: 500 }));

    const result = await executeQuerySpec({
      ...summaryQuery(),
      intent: "comparison",
      groupBy: "party",
      partyCodes: ["LPC", "CPC", "NDP"],
    });

    expect(regionStats.getRegionStats).toHaveBeenCalledTimes(3);
    expect(result.rows).toEqual([
      expect.objectContaining({ label: "LPC", value: 900 }),
      expect.objectContaining({ label: "CPC", value: 700 }),
      expect.objectContaining({ label: "NDP", value: 500 }),
    ]);
  });

  it("compares selected provinces", async () => {
    regionStats.getRegionStats
      .mockResolvedValueOnce(stats({ code: "ON", name: "Ontario", totalDonations: 900 }))
      .mockResolvedValueOnce(stats({ code: "BC", name: "British Columbia", totalDonations: 700 }));

    const result = await executeQuerySpec({
      ...summaryQuery(),
      intent: "comparison",
      groupBy: "province",
      partyCodes: [],
      regionCodes: ["ON", "BC"],
    });

    expect(result.rows).toEqual([
      expect.objectContaining({ label: "Ontario", value: 900 }),
      expect.objectContaining({ label: "British Columbia", value: 700 }),
    ]);
  });

  it("compares the two endpoint years", async () => {
    regionStats.getRegionStats
      .mockResolvedValueOnce(stats({ totalDonations: 500 }))
      .mockResolvedValueOnce(stats({ totalDonations: 900 }));

    const result = await executeQuerySpec({
      ...summaryQuery(),
      intent: "comparison",
      groupBy: "year",
      beginningYear: 2020,
      endingYear: 2023,
    });

    expect(result.rows).toEqual([
      expect.objectContaining({ label: "2020", value: 500 }),
      expect.objectContaining({ label: "2023", value: 900 }),
    ]);
  });

  it("returns separate rows for multi-party trends", async () => {
    regionStats.getNationalStats
      .mockResolvedValueOnce({
        ...stats({ level: "national", code: "CA", name: "Canada" }),
        donationsTrend: [{ year: 2020, totalDonations: 400, donationCount: 8, donorCount: 7 }],
      })
      .mockResolvedValueOnce({
        ...stats({ level: "national", code: "CA", name: "Canada" }),
        donationsTrend: [{ year: 2020, totalDonations: 600, donationCount: 9, donorCount: 8 }],
      });

    const result = await executeQuerySpec({
      intent: "trend",
      metric: "totalDonations",
      groupBy: "year",
      partyCodes: ["LPC", "CPC"],
      regionLevel: "national",
      beginningYear: 2020,
      endingYear: 2021,
      limit: 5,
    });

    expect(result.rows).toEqual([
      expect.objectContaining({ label: "2020 · LPC", value: 400, series: "LPC" }),
      expect.objectContaining({ label: "2020 · CPC", value: 600, series: "CPC" }),
    ]);
  });

  it("ranks years in either direction", async () => {
    regionStats.getNationalStats.mockResolvedValue({
      ...stats({ level: "national", code: "CA", name: "Canada" }),
      donationsTrend: [
        { year: 2020, totalDonations: 900, donationCount: 9, donorCount: 8 },
        { year: 2021, totalDonations: 300, donationCount: 8, donorCount: 7 },
        { year: 2022, totalDonations: 600, donationCount: 7, donorCount: 6 },
      ],
    });

    const result = await executeQuerySpec({
      intent: "ranking",
      metric: "totalDonations",
      groupBy: "year",
      partyCodes: [],
      regionLevel: "national",
      beginningYear: 2020,
      endingYear: 2022,
      limit: 2,
      sortOrder: "asc",
    });

    expect(result.rows.map((row) => row.label)).toEqual(["2021", "2022"]);
  });

  it("ranks party changes between endpoint years", async () => {
    regionStats.getRegionStats
      .mockResolvedValueOnce({
        ...stats(),
        partyStats: [
          { partyCode: "LPC", partyName: "Liberal", totalDonations: 500, donationCount: 10, donorCount: 8 },
          { partyCode: "CPC", partyName: "Conservative", totalDonations: 700, donationCount: 10, donorCount: 8 },
        ],
      })
      .mockResolvedValueOnce({
        ...stats(),
        partyStats: [
          { partyCode: "LPC", partyName: "Liberal", totalDonations: 1000, donationCount: 12, donorCount: 9 },
          { partyCode: "CPC", partyName: "Conservative", totalDonations: 800, donationCount: 12, donorCount: 9 },
        ],
      });

    const result = await executeQuerySpec({
      ...summaryQuery(),
      intent: "change",
      groupBy: "party",
      partyCodes: [],
      beginningYear: 2020,
      endingYear: 2023,
      limit: 1,
    });

    expect(result.rows).toEqual([
      expect.objectContaining({
        label: "Liberal",
        value: 500,
        startValue: 500,
        endValue: 1000,
      }),
    ]);
  });

  it("ranks selected province changes between endpoint years", async () => {
    regionStats.getAllProvinceStats
      .mockResolvedValueOnce([
        stats({ code: "ON", name: "Ontario", totalDonations: 500 }),
        stats({ code: "BC", name: "British Columbia", totalDonations: 700 }),
      ])
      .mockResolvedValueOnce([
        stats({ code: "ON", name: "Ontario", totalDonations: 1100 }),
        stats({ code: "BC", name: "British Columbia", totalDonations: 800 }),
      ]);

    const result = await executeQuerySpec({
      ...summaryQuery(),
      intent: "change",
      groupBy: "province",
      partyCodes: [],
      regionCodes: ["ON", "BC"],
      beginningYear: 2020,
      endingYear: 2023,
      limit: 2,
    });

    expect(result.rows).toEqual([
      expect.objectContaining({ label: "Ontario", value: 600 }),
      expect.objectContaining({ label: "British Columbia", value: 100 }),
    ]);
  });

  it("resolves a riding name for a trend", async () => {
    regionStats.getRidingStatsForProvince.mockResolvedValue([{
      ...stats({ level: "riding", code: "35001", name: "Ajax" }),
      donationsTrend: [
        { year: 2020, totalDonations: 400, donationCount: 10, donorCount: 8 },
      ],
    }]);

    const result = await executeQuerySpec({
      intent: "trend",
      metric: "totalDonations",
      groupBy: "year",
      partyCodes: [],
      regionLevel: "riding",
      regionCode: "Ajax",
      provinceCode: "ON",
      beginningYear: 2020,
      endingYear: 2020,
      boundarySet: "federal_ridings_2013",
      limit: 5,
    });

    expect(result.rows[0]).toMatchObject({ label: "2020", value: 400 });
    expect(regionStats.getRegionStats).not.toHaveBeenCalled();
  });

  it("hides values suppressed by existing privacy rules", async () => {
    regionStats.getRegionStats.mockResolvedValue(
      stats({ totalDonations: 999, donorCount: 3, suppressed: true }),
    );

    const result = await executeQuerySpec(summaryQuery());

    expect(result.rows[0]).toMatchObject({
      value: null,
      suppressed: true,
      suppressionReason: "Below threshold.",
    });
    expect(result.privacy.isSuppressed).toBe(true);
  });

  it("uses the riding aggregate service with boundary options", async () => {
    regionStats.getRidingStatsForProvince.mockResolvedValue([
      stats({
        level: "riding",
        code: "35001",
        name: "Ajax",
        totalDonations: 450,
      }),
    ]);

    await executeQuerySpec({
      intent: "ranking",
      metric: "totalDonations",
      groupBy: "riding",
      partyCodes: [],
      regionLevel: "riding",
      provinceCode: "ON",
      beginningYear: 2015,
      endingYear: 2024,
      boundarySet: "federal_ridings_2013",
      limit: 5,
    });

    expect(regionStats.getRidingStatsForProvince).toHaveBeenCalledWith(
      "ON",
      expect.objectContaining({
        boundarySet: "federal_ridings_2013",
        beginningYear: 2015,
        endingYear: 2024,
      }),
    );
  });

  it("revalidates input and rejects MongoDB-style fields", async () => {
    await expect(
      executeQuerySpec({
        ...summaryQuery(),
        $match: { "totals.totalDonations": { $gt: 0 } },
      }),
    ).rejects.toBeInstanceOf(QuerySpecValidationError);

    expect(regionStats.getRegionStats).not.toHaveBeenCalled();
  });
});
