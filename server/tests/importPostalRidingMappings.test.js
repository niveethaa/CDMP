const {
  buildMappingRow,
  validateMappingRow,
  createCandidate,
} = require("../src/scripts/importPostalRidingMappings");

describe("importPostalRidingMappings helpers", () => {
  it("normalizes a valid postal-riding mapping row", () => {
    const row = buildMappingRow({
      boundarySet: "federal_ridings_2013",
      postalCode: "A1B 0R7",
      fsa: "A1B",
      provinceCode: "nl",
      ridingCode: "10006",
      ridingName: "St. John's East",
      uniqueLink: "1",
      weight: "1",
      sourceFile: "PCFRF_2013_V2212",
      referenceDate: "2022-12",
    });

    expect(row).toEqual({
      boundarySet: "federal_ridings_2013",
      postalCode: "A1B0R7",
      fsa: "A1B",
      provinceCode: "NL",
      ridingCode: "10006",
      ridingName: "St. John's East",
      uniqueLink: true,
      weight: 1,
      sourceFile: "PCFRF_2013_V2212",
      referenceDate: "2022-12",
    });
  });

  it("validates required mapping fields", () => {
    const row = buildMappingRow({
      boundarySet: "",
      postalCode: "",
      fsa: "",
      provinceCode: "",
      ridingCode: "",
      ridingName: "",
    });

    const missingFields = validateMappingRow(row);

    expect(missingFields).toContain("boundarySet");
    expect(missingFields).toContain("postalCode");
    expect(missingFields).toContain("fsa");
    expect(missingFields).toContain("provinceCode");
    expect(missingFields).toContain("ridingCode");
    expect(missingFields).toContain("ridingName");
  });

  it("creates a riding candidate from a mapping row", () => {
    const candidate = createCandidate({
      ridingCode: "10006",
      ridingName: "St. John's East",
      provinceCode: "NL",
      weight: 1,
    });

    expect(candidate).toEqual({
      ridingCode: "10006",
      ridingName: "St. John's East",
      provinceCode: "NL",
      weight: 1,
    });
  });

  it("normalizes non-unique mapping values", () => {
    const row = buildMappingRow({
      boundarySet: "federal_ridings_2003",
      postalCode: "A0A-1A0",
      fsa: "",
      provinceCode: "NL",
      ridingCode: "10001",
      ridingName: "Avalon",
      uniqueLink: "0",
      weight: "0.25",
      sourceFile: "PCFRF_2003_SEP06",
      referenceDate: "2006-09",
    });

    expect(row.postalCode).toBe("A0A1A0");
    expect(row.fsa).toBe("A0A");
    expect(row.uniqueLink).toBe(false);
    expect(row.weight).toBe(0.25);
  });
});
