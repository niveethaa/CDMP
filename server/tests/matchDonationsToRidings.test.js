const {
  normalizePostalCode,
  resolveBoundarySetForYear,
  buildMatchResult,
  buildAssignmentBulkOperation,
  buildDonationGeographyBulkOperation,
} = require("../src/scripts/matchDonationsToRidings");

const boundarySets = [
  {
    code: "federal_ridings_2003",
    validFromYear: 2004,
    validToYear: 2014,
  },
  {
    code: "federal_ridings_2013",
    validFromYear: 2015,
    validToYear: 2024,
  },
  {
    code: "federal_ridings_2023",
    validFromYear: 2025,
    validToYear: null,
  },
];

describe("matchDonationsToRidings helpers", () => {
  it("normalizes postal codes", () => {
    expect(normalizePostalCode("A1B 0R7")).toBe("A1B0R7");
    expect(normalizePostalCode(" a1b-0r7 ")).toBe("A1B0R7");
    expect(normalizePostalCode("")).toBe("");
    expect(normalizePostalCode(null)).toBe("");
  });

  it("resolves boundary set by donation year", () => {
    expect(resolveBoundarySetForYear(boundarySets, 2004).code).toBe(
      "federal_ridings_2003",
    );
    expect(resolveBoundarySetForYear(boundarySets, 2014).code).toBe(
      "federal_ridings_2003",
    );
    expect(resolveBoundarySetForYear(boundarySets, 2015).code).toBe(
      "federal_ridings_2013",
    );
    expect(resolveBoundarySetForYear(boundarySets, 2024).code).toBe(
      "federal_ridings_2013",
    );
    expect(resolveBoundarySetForYear(boundarySets, 2025).code).toBe(
      "federal_ridings_2023",
    );
    expect(resolveBoundarySetForYear(boundarySets, "bad-year")).toBeNull();
  });

  it("builds a matched result for a unique postal-riding mapping", () => {
    const donation = {
      _id: "donation-id-1",
      source: {
        year: 2020,
      },
      donor: {
        postalCode: "A1B 0R7",
        province: "NL",
      },
      geography: {
        provinceCode: "NL",
      },
    };

    const mapping = {
      postalCode: "A1B0R7",
      boundarySet: "federal_ridings_2013",
      candidates: [
        {
          ridingCode: "10006",
          ridingName: "St. John's East",
          provinceCode: "NL",
          weight: 1,
        },
      ],
    };

    const result = buildMatchResult({
      donation,
      boundarySet: boundarySets[1],
      mapping,
    });

    expect(result).toEqual({
      donationId: "donation-id-1",
      donationYear: 2020,
      boundarySet: "federal_ridings_2013",
      ridingCode: "10006",
      ridingName: "St. John's East",
      provinceCode: "NL",
      matchStatus: "matched",
      matchMethod: "postal_code",
      confidence: "high",
      notes: "",
    });
  });

  it("builds an ambiguous result for multiple riding candidates", () => {
    const donation = {
      _id: "donation-id-2",
      source: {
        year: 2020,
      },
      donor: {
        postalCode: "A1B 0R7",
        province: "NL",
      },
      geography: {
        provinceCode: "NL",
      },
    };

    const mapping = {
      postalCode: "A1B0R7",
      boundarySet: "federal_ridings_2013",
      candidates: [
        {
          ridingCode: "10006",
          ridingName: "St. John's East",
          provinceCode: "NL",
          weight: 0.6,
        },
        {
          ridingCode: "10007",
          ridingName: "St. John's South—Mount Pearl",
          provinceCode: "NL",
          weight: 0.4,
        },
      ],
    };

    const result = buildMatchResult({
      donation,
      boundarySet: boundarySets[1],
      mapping,
    });

    expect(result.matchStatus).toBe("ambiguous");
    expect(result.matchMethod).toBe("postal_code");
    expect(result.confidence).toBe("low");
    expect(result.ridingCode).toBe("");
    expect(result.ridingName).toBe("");
    expect(result.notes).toContain("2 riding candidates");
  });

  it("builds an unmatched result when no mapping exists", () => {
    const donation = {
      _id: "donation-id-3",
      source: {
        year: 2020,
      },
      donor: {
        postalCode: "A1B 0R7",
        province: "NL",
      },
      geography: {
        provinceCode: "NL",
      },
    };

    const result = buildMatchResult({
      donation,
      boundarySet: boundarySets[1],
      mapping: null,
    });

    expect(result.matchStatus).toBe("unmatched");
    expect(result.matchMethod).toBe("none");
    expect(result.confidence).toBe("none");
    expect(result.notes).toContain("No postal-riding mapping found");
  });

  it("builds an unmatched result when donation has no postal code", () => {
    const donation = {
      _id: "donation-id-4",
      source: {
        year: 2020,
      },
      donor: {
        postalCode: "",
        province: "NL",
      },
      geography: {
        provinceCode: "NL",
      },
    };

    const result = buildMatchResult({
      donation,
      boundarySet: boundarySets[1],
      mapping: null,
    });

    expect(result.matchStatus).toBe("unmatched");
    expect(result.notes).toBe("Donation has no postal code.");
  });

  it("builds assignment bulk operation", () => {
    const matchResult = {
      donationId: "donation-id-1",
      donationYear: 2020,
      boundarySet: "federal_ridings_2013",
      ridingCode: "10006",
      ridingName: "St. John's East",
      provinceCode: "NL",
      matchStatus: "matched",
      matchMethod: "postal_code",
      confidence: "high",
      notes: "",
    };

    const operation = buildAssignmentBulkOperation(matchResult);

    expect(operation.updateOne.filter).toEqual({
      donationId: "donation-id-1",
      boundarySet: "federal_ridings_2013",
    });

    expect(operation.updateOne.update.$set.matchStatus).toBe("matched");
    expect(operation.updateOne.update.$set.ridingCode).toBe("10006");
    expect(operation.updateOne.upsert).toBe(true);
  });

  it("builds donation geography bulk operation", () => {
    const matchResult = {
      donationId: "donation-id-1",
      boundarySet: "federal_ridings_2013",
      ridingCode: "10006",
      ridingName: "St. John's East",
      matchStatus: "matched",
    };

    const operation = buildDonationGeographyBulkOperation(matchResult);

    expect(operation.updateOne.filter).toEqual({
      _id: "donation-id-1",
    });

    expect(operation.updateOne.update.$set).toEqual({
      "geography.ridingCode": "10006",
      "geography.ridingName": "St. John's East",
      "geography.boundarySet": "federal_ridings_2013",
      "geography.geoCodeStatus": "matched",
    });
  });
});
