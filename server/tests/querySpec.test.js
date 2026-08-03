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
    regionCodes: [],
    regionLevel: "province",
    regionCode: "on",
    beginningYear: 2019,
    endingYear: 2024,
    boundarySet: null,
    limit: 5,
    sortOrder: "desc",
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
      regionCodes: [],
      regionLevel: "province",
      regionCode: "ON",
      provinceCode: "ON",
      beginningYear: 2019,
      endingYear: 2024,
      boundarySet: null,
      limit: 5,
      sortOrder: "desc",
    });
  });

  it("applies simple defaults", () => {
    expect(validateQuerySpec({ intent: "summary" })).toMatchObject({
      metric: "totalDonations",
      groupBy: null,
      partyCodes: [],
      regionCodes: [],
      regionLevel: "national",
      regionCode: "CA",
      beginningYear: 2023,
      endingYear: 2023,
      limit: 5,
      sortOrder: "desc",
    });
  });

  it("uses a five-year default for trends and changes", () => {
    expect(validateQuerySpec({
      intent: "trend",
      groupBy: "year",
    })).toMatchObject({
      beginningYear: 2019,
      endingYear: 2023,
    });
    expect(validateQuerySpec({
      intent: "change",
      groupBy: "party",
    })).toMatchObject({
      beginningYear: 2019,
      endingYear: 2023,
    });
  });

  test.each([
    ["intent", { intent: "delete" }, "Unsupported intent"],
    ["metric", { metric: "largestDonation" }, "Unsupported metric"],
    ["party", { partyCodes: ["XYZ"] }, "Unsupported party code"],
    ["year", { beginningYear: 1992 }, "beginningYear must be between"],
    ["limit", { limit: 11 }, "limit must be an integer"],
    ["sort order", { sortOrder: "sideways" }, "Unsupported sort order"],
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

  it("rejects per-capita metrics", () => {
    expect(() =>
      validateQuerySpec(validSummary({ metric: "perCapitaAmount" })),
    ).toThrow("Unsupported metric");
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

  it("accepts comparisons of two through six parties", () => {
    const comparison = {
      ...validSummary(),
      intent: "comparison",
      groupBy: "party",
    };

    expect(
      validateQuerySpec({ ...comparison, partyCodes: ["LPC", "CPC", "NDP"] })
        .partyCodes,
    ).toEqual(["LPC", "CPC", "NDP"]);
    expect(() =>
      validateQuerySpec({ ...comparison, partyCodes: ["LPC"] }),
    ).toThrow("between two and six party codes");
    expect(
      validateQuerySpec({ ...comparison, partyCodes: ["lpc", "cpc"] })
        .partyCodes,
    ).toEqual(["LPC", "CPC"]);
  });

  it("accepts province comparisons", () => {
    expect(
      validateQuerySpec({
        ...validSummary(),
        intent: "comparison",
        groupBy: "province",
        partyCodes: [],
        regionCodes: ["on", "bc", "ab"],
      }),
    ).toMatchObject({
      regionCodes: ["ON", "BC", "AB"],
      regionLevel: "province",
      regionCode: null,
      provinceCode: null,
    });
  });

  it("accepts year comparisons", () => {
    expect(
      validateQuerySpec({
        ...validSummary(),
        intent: "comparison",
        groupBy: "year",
        beginningYear: 2019,
        endingYear: 2023,
      }),
    ).toMatchObject({
      groupBy: "year",
      beginningYear: 2019,
      endingYear: 2023,
    });
  });

  it("accepts multi-party trends", () => {
    expect(
      validateQuerySpec({
        ...validSummary(),
        intent: "trend",
        groupBy: "year",
        partyCodes: ["LPC", "CPC", "NDP"],
      }).partyCodes,
    ).toEqual(["LPC", "CPC", "NDP"]);
  });

  it("accepts highest and lowest year rankings", () => {
    expect(
      validateQuerySpec({
        ...validSummary(),
        intent: "ranking",
        groupBy: "year",
        sortOrder: "asc",
        limit: 10,
      }),
    ).toMatchObject({
      groupBy: "year",
      sortOrder: "asc",
      limit: 10,
    });
  });

  it("accepts party and province change rankings", () => {
    expect(
      validateQuerySpec({
        ...validSummary(),
        intent: "change",
        groupBy: "party",
        partyCodes: [],
      }),
    ).toMatchObject({ intent: "change", groupBy: "party" });

    expect(
      validateQuerySpec({
        ...validSummary(),
        intent: "change",
        groupBy: "province",
        partyCodes: ["NDP"],
        regionCodes: ["ON", "BC"],
      }),
    ).toMatchObject({
      intent: "change",
      groupBy: "province",
      regionCodes: ["ON", "BC"],
    });
  });

  it("rejects invalid expanded-query combinations", () => {
    expect(() =>
      validateQuerySpec({
        ...validSummary(),
        regionCodes: ["ON", "BC"],
      }),
    ).toThrow("regionCodes are only supported");

    expect(() =>
      validateQuerySpec({
        ...validSummary(),
        intent: "comparison",
        groupBy: "province",
        partyCodes: [],
        regionCodes: ["ON"],
      }),
    ).toThrow("at least two regionCodes");

    expect(() =>
      validateQuerySpec({
        ...validSummary(),
        intent: "change",
        groupBy: "party",
        partyCodes: [],
        beginningYear: 2023,
        endingYear: 2023,
      }),
    ).toThrow("require two different years");
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
