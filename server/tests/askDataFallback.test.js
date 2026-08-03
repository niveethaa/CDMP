const {
  buildFallbackQuerySpec,
  detectIntent,
  detectMetric,
} = require("../src/services/askDataFallback.service");
const { validateQuerySpec } = require("../src/services/querySpec.service");

describe("Ask Data deterministic fallback", () => {
  it("detects supported intents and metrics", () => {
    expect(detectIntent("Track Conservative donor counts over time")).toBe("trend");
    expect(detectIntent("Which party increased the most")).toBe("change");
    expect(detectMetric("How many donations were made")).toBe("donationCount");
    expect(detectMetric("Which riding had the lowest average donation")).toBe("averageDonation");
  });

  test.each([
    [
      "How many NDP donations were made in British Columbia from 2019 to 2022?",
      { intent: "summary", metric: "donationCount", regionCode: "BC", beginningYear: 2019, endingYear: 2022 },
    ],
    [
      "Which two parties had the lowest average donation in Ontario in 2022?",
      { intent: "ranking", metric: "averageDonation", groupBy: "party", regionCode: "ON", sortOrder: "asc", limit: 2 },
    ],
    [
      "Which Ontario riding had the lowest average donation in 2023?",
      { intent: "ranking", metric: "averageDonation", groupBy: "riding", provinceCode: "ON", boundarySet: "federal_ridings_2013", limit: 1 },
    ],
    [
      "Compare Liberal donor counts in Quebec in 2018 and 2022.",
      { intent: "comparison", metric: "donorCount", groupBy: "year", regionCode: "QC", beginningYear: 2018, endingYear: 2022 },
    ],
    [
      "Between Ontario, Quebec, and Alberta, which province had the largest increase in donations from 2019 to 2023?",
      { intent: "change", groupBy: "province", regionCodes: ["ON", "AB", "QC"], limit: 1 },
    ],
    [
      "Show the top ridings in Ontario.",
      { intent: "ranking", groupBy: "riding", provinceCode: "ON", beginningYear: 2023, endingYear: 2023 },
    ],
  ])("builds a valid fallback for %s", (question, expected) => {
    const result = validateQuerySpec(buildFallbackQuerySpec({ question }));
    expect(result).toMatchObject(expected);
  });

  it("preserves a resolved named riding", () => {
    const result = validateQuerySpec(buildFallbackQuerySpec({
      question: "Who raised more, Liberals or Conservatives, in Ajax?",
      ridingContext: {
        name: "Ajax",
        provinceCode: "ON",
        boundarySet: "federal_ridings_2013",
      },
    }));

    expect(result).toMatchObject({
      intent: "comparison",
      groupBy: "party",
      partyCodes: ["LPC", "CPC"],
      regionLevel: "riding",
      regionCode: "AJAX",
      provinceCode: "ON",
      beginningYear: 2023,
      endingYear: 2023,
    });
  });

  it("changes only the geography for an elliptical riding follow-up", () => {
    const previousQuery = validateQuerySpec({
      intent: "comparison",
      metric: "totalDonations",
      groupBy: "party",
      partyCodes: ["LPC", "CPC"],
      regionCodes: [],
      regionLevel: "riding",
      regionCode: "Ajax",
      provinceCode: "ON",
      beginningYear: 2023,
      endingYear: 2023,
      boundarySet: "federal_ridings_2013",
      limit: 2,
      sortOrder: "desc",
    });
    const result = validateQuerySpec(buildFallbackQuerySpec({
      question: "What about Davenport?",
      previousQuery,
      ridingContext: {
        name: "Davenport",
        provinceCode: "ON",
        boundarySet: "federal_ridings_2013",
      },
    }));

    expect(result).toMatchObject({
      intent: "comparison",
      metric: "totalDonations",
      groupBy: "party",
      partyCodes: ["LPC", "CPC"],
      regionLevel: "riding",
      regionCode: "DAVENPORT",
      provinceCode: "ON",
    });
  });
});
