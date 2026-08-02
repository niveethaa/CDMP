const {
  boundarySetForPeriod,
  findMatchingRidings,
} = require("../src/services/ridingContext.service");

const catalog = [
  { name: "Ajax", provinceCode: "ON", boundarySet: "federal_ridings_2013" },
  { name: "Davenport", provinceCode: "ON", boundarySet: "federal_ridings_2013" },
  { name: "Toronto Centre", provinceCode: "ON", boundarySet: "federal_ridings_2003" },
  { name: "Toronto Centre", provinceCode: "ON", boundarySet: "federal_ridings_2013" },
  { name: "Québec", provinceCode: "QC", boundarySet: "federal_ridings_2013" },
];

describe("Riding context resolution", () => {
  it("selects the boundary set for a supported period", () => {
    expect(boundarySetForPeriod(2000, 2000)).toBe("federal_ridings_1996");
    expect(boundarySetForPeriod(2008, 2012)).toBe("federal_ridings_2003");
    expect(boundarySetForPeriod(2019, 2023)).toBe("federal_ridings_2013");
    expect(boundarySetForPeriod(2010, 2020)).toBeNull();
  });

  it("finds a riding in free-form text", () => {
    expect(findMatchingRidings(
      "Could you tell me how Ajax did for Liberal donations?",
      catalog,
      2023,
      2023,
    )).toEqual([
      expect.objectContaining({
        name: "Ajax",
        provinceCode: "ON",
        boundarySet: "federal_ridings_2013",
      }),
    ]);
  });

  it("uses the compatible vintage for repeated riding names", () => {
    expect(findMatchingRidings(
      "What happened in Toronto Centre in 2010?",
      catalog,
      2010,
      2010,
    )).toEqual([
      expect.objectContaining({ boundarySet: "federal_ridings_2003" }),
    ]);
  });

  it("returns multiple named ridings without guessing", () => {
    expect(findMatchingRidings(
      "Compare Ajax and Davenport in 2023",
      catalog,
      2023,
      2023,
    ).map((riding) => riding.name)).toEqual(["Davenport", "Ajax"]);
  });

  it("does not mistake a province name for a same-named riding", () => {
    expect(findMatchingRidings(
      "Compare Liberal donor counts in Quebec in 2018 and 2022",
      catalog,
      2018,
      2022,
    )).toEqual([]);
  });
});
