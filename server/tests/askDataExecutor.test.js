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

  it("compares two parties using separately filtered aggregates", async () => {
    regionStats.getRegionStats
      .mockResolvedValueOnce(stats({ totalDonations: 900 }))
      .mockResolvedValueOnce(stats({ totalDonations: 700 }));

    const result = await executeQuerySpec({
      ...summaryQuery(),
      intent: "comparison",
      groupBy: "party",
      partyCodes: ["LPC", "CPC"],
    });

    expect(regionStats.getRegionStats).toHaveBeenCalledTimes(2);
    expect(result.rows).toEqual([
      expect.objectContaining({ label: "LPC", value: 900 }),
      expect.objectContaining({ label: "CPC", value: 700 }),
    ]);
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
