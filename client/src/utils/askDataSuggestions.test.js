import { generateSuggestions } from "./askDataSuggestions";

function query(overrides = {}) {
  return {
    intent: "summary",
    metric: "totalDonations",
    groupBy: null,
    partyCodes: [],
    regionLevel: "province",
    regionCode: "ON",
    provinceCode: "ON",
    beginningYear: 2023,
    endingYear: 2023,
    ...overrides,
  };
}

describe("Ask Data suggestions", () => {
  it("generates valid aggregate and all-party questions", () => {
    expect(generateSuggestions(query())).toEqual([
      "Show the total donation trend in Ontario from 2019 to 2023",
      "Compare donations across all six parties in Ontario in 2023",
      "Show the same data for 2019",
    ]);
  });

  it("generates a two-party comparison when one party is selected", () => {
    expect(generateSuggestions(query({ partyCodes: ["LPC"] }))).toContain(
      "Compare Liberal and Conservative donations in Ontario in 2023",
    );
  });

  it("does not generate the ambiguous all-parties comparison", () => {
    const suggestions = generateSuggestions(query({ intent: "trend", groupBy: "year" }));

    expect(suggestions.join(" ")).not.toContain("Compare all parties and");
  });

  it("includes the period in generated riding questions", () => {
    const suggestions = generateSuggestions(query({
      intent: "comparison",
      groupBy: "party",
      partyCodes: ["LPC", "CPC"],
    }));

    expect(suggestions).toContain(
      "Which ridings in Ontario had the most Liberal donations in 2023?",
    );
  });

  it("preserves a named riding in generated follow-ups", () => {
    expect(generateSuggestions(query({
      regionLevel: "riding",
      regionCode: "Ajax",
      provinceCode: "ON",
    }))).toEqual([
      "Show the total donation trend in Ajax, Ontario from 2019 to 2023",
      "Compare donations across all six parties in Ajax, Ontario in 2023",
      "Show the same data for 2019",
    ]);
  });

  it("generates valid range suggestions for a selected party", () => {
    expect(generateSuggestions(query({
      partyCodes: ["LPC"],
      regionLevel: "national",
      regionCode: "CA",
      provinceCode: null,
      beginningYear: 2020,
      endingYear: 2023,
    }))).toEqual([
      "Show the Liberal donation trend nationally from 2020 to 2023",
      "Compare Liberal and Conservative donations nationally in 2020–2023",
      "Which party increased donations the most nationally from 2020 to 2023?",
    ]);
  });

  it("generates valid all-party trend follow-ups", () => {
    expect(generateSuggestions(query({
      intent: "trend",
      groupBy: "year",
      regionLevel: "national",
      regionCode: "CA",
      provinceCode: null,
      beginningYear: 2020,
      endingYear: 2023,
    }))).toEqual([
      "Compare donations across all six parties nationally in 2020–2023",
      "Which party increased donations the most nationally from 2020 to 2023?",
      "Which year had the most total donations across all parties nationally from 2020 to 2023?",
    ]);
  });

  it("generates a province ranking from a national comparison", () => {
    expect(generateSuggestions(query({
      intent: "comparison",
      groupBy: "party",
      partyCodes: ["LPC", "CPC"],
      regionLevel: "national",
      regionCode: "CA",
      provinceCode: null,
    }))).toContain(
      "Which province had the most Liberal donations in 2023?",
    );
  });
});
