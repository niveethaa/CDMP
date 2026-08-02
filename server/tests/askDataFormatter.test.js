const {
  formatAnswer,
} = require("../src/services/askDataFormatter.service");

function query(overrides = {}) {
  return {
    intent: "ranking",
    metric: "totalDonations",
    groupBy: "party",
    beginningYear: 2020,
    endingYear: 2023,
    sortOrder: "desc",
    ...overrides,
  };
}

describe("Ask Data answer formatter", () => {
  it("describes lowest-value rankings", () => {
    const answer = formatAnswer(
      query({ sortOrder: "asc" }),
      [{ label: "Green", value: 500, suppressed: false }],
    );

    expect(answer).toContain("lowest total donations");
  });

  it("formats comparisons containing more than two rows", () => {
    const answer = formatAnswer(
      query({ intent: "comparison" }),
      [
        { label: "LPC", value: 900, suppressed: false },
        { label: "CPC", value: 700, suppressed: false },
        { label: "NDP", value: 500, suppressed: false },
      ],
    );

    expect(answer).toContain("LPC had $900, CPC had $700, and NDP had $500");
  });

  it("formats multi-party trends by series", () => {
    const answer = formatAnswer(
      query({ intent: "trend", groupBy: "year" }),
      [
        { label: "2020 · LPC", year: 2020, series: "LPC", value: 500, suppressed: false },
        { label: "2023 · LPC", year: 2023, series: "LPC", value: 900, suppressed: false },
        { label: "2020 · CPC", year: 2020, series: "CPC", value: 700, suppressed: false },
        { label: "2023 · CPC", year: 2023, series: "CPC", value: 600, suppressed: false },
      ],
    );

    expect(answer).toContain("LPC total donations went from $500 in 2020 to $900 in 2023");
    expect(answer).toContain("CPC total donations went from $700 in 2020 to $600 in 2023");
  });

  it("formats positive and negative changes", () => {
    const answer = formatAnswer(
      query({ intent: "change" }),
      [
        { label: "Liberal", value: 500, suppressed: false },
        { label: "Conservative", value: -200, suppressed: false },
      ],
    );

    expect(answer).toContain("Liberal increased by $500");
    expect(answer).toContain("Conservative decreased by $200");
  });

  it("explains when no ranked group increased", () => {
    const answer = formatAnswer(
      query({ intent: "change" }),
      [{ label: "Liberal", value: -200, suppressed: false }],
    );

    expect(answer).toContain("No party increased");
    expect(answer).toContain("Liberal decreased by $200");
  });

  it("explains when population data is unavailable", () => {
    const answer = formatAnswer(
      query({ intent: "summary", metric: "perCapitaAmount" }),
      [{
        label: "Canada",
        value: null,
        suppressed: false,
        unavailable: true,
        unavailableReason: "Population data is unavailable for this selection.",
      }],
    );

    expect(answer).toBe("Population data is unavailable for this selection.");
  });
});
