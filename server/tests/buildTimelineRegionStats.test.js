const {
  calculateAverage,
  buildPrivacy,
  buildTrendPoint,
  createRegionStat,
  buildRegionStatUpsertFilter,
  makeProvinceKey,
  makeRidingKey,
} = require("../src/scripts/buildTimelineRegionStats");

describe("buildTimelineRegionStats helpers", () => {
  it("calculates average donation correctly", () => {
    expect(calculateAverage(1000, 4)).toBe(250);
    expect(calculateAverage(125.75, 2)).toBe(62.88);
  });

  it("returns 0 average when donation count is 0", () => {
    expect(calculateAverage(1000, 0)).toBe(0);
    expect(calculateAverage(0, 0)).toBe(0);
  });

  it("builds privacy suppression metadata", () => {
    const suppressed = buildPrivacy(3);
    const notSuppressed = buildPrivacy(5);

    expect(suppressed.isSuppressed).toBe(true);
    expect(suppressed.suppressionThreshold).toBe(5);
    expect(suppressed.suppressionReason).toContain(
      "below suppression threshold",
    );

    expect(notSuppressed.isSuppressed).toBe(false);
    expect(notSuppressed.suppressionReason).toBe("");
  });

  it("builds no-data suppression metadata", () => {
    const privacy = buildPrivacy(0);

    expect(privacy.isSuppressed).toBe(true);
    expect(privacy.suppressionReason).toBe(
      "No donation data available for this region.",
    );
  });

  it("builds a trend point for an annual RegionStat", () => {
    const trendPoint = buildTrendPoint(2020, {
      totalDonations: 1000,
      donationCount: 4,
      donorCount: 3,
      perCapitaAmount: 0,
    });

    expect(trendPoint).toEqual({
      year: 2020,
      totalDonations: 1000,
      donationCount: 4,
      donorCount: 3,
      perCapitaAmount: 0,
    });
  });

  it("creates a national annual RegionStat", () => {
    const region = {
      level: "national",
      code: "CA",
      name: "Canada",
      provinceCode: "",
      boundarySet: "national_2024",
    };

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

    const regionStat = createRegionStat(region, 2020, totals, partyStats);

    expect(regionStat.region).toEqual({
      level: "national",
      code: "CA",
      name: "Canada",
      provinceCode: "",
      boundarySet: "national_2024",
    });

    expect(regionStat.filters).toEqual({
      beginningYear: 2020,
      endingYear: 2020,
      partyCode: "ALL",
      metricMode: "total",
    });

    expect(regionStat.totals.totalDonations).toBe(1000);
    expect(regionStat.totals.donationCount).toBe(4);
    expect(regionStat.totals.donorCount).toBe(4);
    expect(regionStat.totals.averageDonation).toBe(250);
    expect(regionStat.partyStats).toHaveLength(2);
    expect(regionStat.donationsTrend).toHaveLength(1);
    expect(regionStat.donationsTrend[0].year).toBe(2020);
    expect(regionStat.privacy.isSuppressed).toBe(true);
  });

  it("creates a riding annual RegionStat with boundary set", () => {
    const region = {
      level: "riding",
      code: "10006",
      name: "St. John's East",
      provinceCode: "NL",
      boundarySet: "federal_ridings_2013",
    };

    const totals = {
      totalDonations: 1500,
      donationCount: 5,
      donorCount: 5,
    };

    const regionStat = createRegionStat(region, 2020, totals, []);

    expect(regionStat.region.level).toBe("riding");
    expect(regionStat.region.code).toBe("10006");
    expect(regionStat.region.name).toBe("St. John's East");
    expect(regionStat.region.provinceCode).toBe("NL");
    expect(regionStat.region.boundarySet).toBe("federal_ridings_2013");
    expect(regionStat.filters.beginningYear).toBe(2020);
    expect(regionStat.filters.endingYear).toBe(2020);
    expect(regionStat.totals.averageDonation).toBe(300);
    expect(regionStat.privacy.isSuppressed).toBe(false);
  });

  it("builds RegionStat upsert filter", () => {
    const regionStat = {
      region: {
        level: "riding",
        code: "10006",
        boundarySet: "federal_ridings_2013",
      },
      filters: {
        beginningYear: 2020,
        endingYear: 2020,
        partyCode: "ALL",
        metricMode: "total",
      },
    };

    expect(buildRegionStatUpsertFilter(regionStat)).toEqual({
      "region.level": "riding",
      "region.code": "10006",
      "region.boundarySet": "federal_ridings_2013",
      "filters.beginningYear": 2020,
      "filters.endingYear": 2020,
      "filters.partyCode": "ALL",
      "filters.metricMode": "total",
    });
  });

  it("builds province and riding map keys", () => {
    expect(makeProvinceKey(2020, "ON")).toBe("2020|ON");
    expect(makeRidingKey(2020, "federal_ridings_2013", "10006")).toBe(
      "2020|federal_ridings_2013|10006",
    );
  });
});
