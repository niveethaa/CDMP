const {
  boundarySets,
  getBoundarySetForYear,
} = require("../src/scripts/seedBoundarySets");

describe("seedBoundarySets script helpers", () => {
  it("defines the expected initial boundary sets", () => {
    const codes = boundarySets.map((boundarySet) => boundarySet.code);

    expect(codes).toContain("federal_ridings_2003");
    expect(codes).toContain("federal_ridings_2013");
    expect(codes).toContain("federal_ridings_2023");
  });

  it("resolves 2004-2014 years to the 2003 boundary set", () => {
    expect(getBoundarySetForYear(2004).code).toBe("federal_ridings_2003");
    expect(getBoundarySetForYear(2014).code).toBe("federal_ridings_2003");
  });

  it("resolves 2015-2024 years to the 2013 boundary set", () => {
    expect(getBoundarySetForYear(2015).code).toBe("federal_ridings_2013");
    expect(getBoundarySetForYear(2024).code).toBe("federal_ridings_2013");
  });

  it("resolves 2025 onward to the 2023 boundary set", () => {
    expect(getBoundarySetForYear(2025).code).toBe("federal_ridings_2023");
    expect(getBoundarySetForYear(2030).code).toBe("federal_ridings_2023");
  });

  it("returns null for invalid or unsupported years", () => {
    expect(getBoundarySetForYear("not-a-year")).toBeNull();
    expect(getBoundarySetForYear(2003)).toBeNull();
  });
});
