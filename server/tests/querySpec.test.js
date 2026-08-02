const {
  QuerySpecValidationError,
  validateQuerySpec,
} = require("../src/services/querySpec.service");

function validSummary(overrides = {}) {
  return {
    intent: "summary",
    metric: "totalDonations",
    groupBy: null,
    partyCodes: ["lpc"],
    regionLevel: "province",
    regionCode: "on",
    beginningYear: 2019,
    endingYear: 2024,
    boundarySet: null,
    limit: 5,
    ...overrides,
  };
}

describe("QuerySpec validation", () => {
  it("normalizes a valid QuerySpec", () => {
    expect(validateQuerySpec(validSummary())).toEqual({
      intent: "summary",
      metric: "totalDonations",
      groupBy: null,
      partyCodes: ["LPC"],
      regionLevel: "province",
      regionCode: "ON",
      provinceCode: "ON",
      beginningYear: 2019,
      endingYear: 2024,
      boundarySet: null,
      limit: 5,
    });
  });

  it("applies simple defaults", () => {
    expect(validateQuerySpec({ intent: "summary" })).toMatchObject({
      metric: "totalDonations",
      groupBy: null,
      partyCodes: [],
      regionLevel: "national",
      regionCode: "CA",
      beginningYear: 1993,
      endingYear: 2024,
      limit: 5,
    });
  });

  test.each([
    ["intent", { intent: "delete" }, "Unsupported intent"],
    ["metric", { metric: "largestDonation" }, "Unsupported metric"],
    ["party", { partyCodes: ["XYZ"] }, "Unsupported party code"],
    ["year", { beginningYear: 1992 }, "beginningYear must be between"],
    ["limit", { limit: 6 }, "limit must be an integer"],
    ["province", { regionCode: "ZZ" }, "Unsupported province regionCode"],
  ])("rejects an invalid %s", (_name, overrides, message) => {
    expect(() => validateQuerySpec(validSummary(overrides))).toThrow(message);
  });

  it("rejects reversed year ranges", () => {
    expect(() =>
      validateQuerySpec(
        validSummary({ beginningYear: 2024, endingYear: 2020 }),
      ),
    ).toThrow("beginningYear cannot be after endingYear");
  });

  it("rejects unknown fields and MongoDB operators", () => {
    for (const unsafeField of ["$where", "$match", "$regex"]) {
      try {
        validateQuerySpec(validSummary({ [unsafeField]: "unsafe" }));
        throw new Error("Expected validation to fail.");
      } catch (error) {
        expect(error).toBeInstanceOf(QuerySpecValidationError);
        expect(error.errors).toContain(
          "MongoDB operators are not allowed in QuerySpec.",
        );
      }
    }

    expect(() =>
      validateQuerySpec(validSummary({ unexpected: true })),
    ).toThrow("Unknown QuerySpec field");
  });

  it("restricts comparisons to exactly two parties", () => {
    const comparison = {
      ...validSummary(),
      intent: "comparison",
      groupBy: "party",
    };

    expect(() =>
      validateQuerySpec({ ...comparison, partyCodes: ["LPC", "CPC", "NDP"] }),
    ).toThrow("exactly two party codes");
    expect(() =>
      validateQuerySpec({ ...comparison, partyCodes: ["LPC"] }),
    ).toThrow("exactly two party codes");
    expect(
      validateQuerySpec({ ...comparison, partyCodes: ["lpc", "cpc"] })
        .partyCodes,
    ).toEqual(["LPC", "CPC"]);
  });

  it("enforces trend grouping", () => {
    expect(() =>
      validateQuerySpec({
        ...validSummary(),
        intent: "trend",
        groupBy: "province",
      }),
    ).toThrow("Trend queries must group by year");
  });

  it("enforces province ranking fields", () => {
    const result = validateQuerySpec({
      ...validSummary(),
      intent: "ranking",
      groupBy: "province",
    });

    expect(result.regionCode).toBeNull();
    expect(result.provinceCode).toBeNull();

    expect(
      validateQuerySpec({
        ...validSummary(),
        intent: "ranking",
        groupBy: "province",
        regionLevel: "national",
        regionCode: "CA",
      }),
    ).toMatchObject({
      regionLevel: "province",
      regionCode: null,
      provinceCode: null,
    });
  });

  it("accepts provinceCode as the province identifier", () => {
    expect(
      validateQuerySpec(
        validSummary({ regionCode: null, provinceCode: "on" }),
      ),
    ).toMatchObject({
      regionCode: "ON",
      provinceCode: "ON",
    });
  });

  it("requires a province code for non-ranking province queries", () => {
    expect(() =>
      validateQuerySpec(
        validSummary({ regionCode: null, provinceCode: null }),
      ),
    ).toThrow("Province queries require a province code");
  });

  it("requires compatible riding ranking fields", () => {
    const result = validateQuerySpec({
      intent: "ranking",
      metric: "donationCount",
      groupBy: "riding",
      partyCodes: ["NDP"],
      regionLevel: "riding",
      provinceCode: "on",
      beginningYear: 2015,
      endingYear: 2024,
      boundarySet: "federal_ridings_2013",
      limit: 3,
    });

    expect(result.provinceCode).toBe("ON");
    expect(result.regionCode).toBeNull();

    expect(() =>
      validateQuerySpec({
        ...result,
        beginningYear: 2010,
      }),
    ).toThrow("only supports 2015–2024");
  });
});
