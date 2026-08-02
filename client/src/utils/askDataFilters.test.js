import { describe, it, expect } from "@jest/globals";
import {
  isMapCompatible,
  convertToMapFilters,
  getProvinceCode,
  getRidingCode,
} from "./askDataFilters";

describe("askDataFilters", () => {
  describe("isMapCompatible", () => {
    it("returns false for null input", () => {
      expect(isMapCompatible(null)).toBe(false);
    });

    it("returns false for change and comparison intents", () => {
      expect(isMapCompatible({ intent: "change" })).toBe(false);
      expect(isMapCompatible({ intent: "comparison" })).toBe(false);
    });

    it("returns false when multiple parties are selected", () => {
      expect(isMapCompatible({ partyCodes: ["CPC", "LPC"] })).toBe(false);
    });

    it("returns false when multiple region codes are present", () => {
      expect(isMapCompatible({ regionCodes: ["ON", "AB"] })).toBe(false);
    });

    it("returns false for a riding without a boundary set", () => {
      expect(isMapCompatible({ regionLevel: "riding" })).toBe(false);
    });

    it("returns true for a simple compatible filter", () => {
      expect(
        isMapCompatible({ intent: "summary", partyCodes: ["CPC"] })
      ).toBe(true);
    });
  });

  describe("convertToMapFilters", () => {
    it("returns null for null input", () => {
      expect(convertToMapFilters(null)).toBe(null);
    });

    it("maps a single party and year range", () => {
      const result = convertToMapFilters({
        partyCodes: ["CPC"],
        beginningYear: 2015,
        endingYear: 2024,
        metric: "totalDonations",
      });
      expect(result.partyCode).toBe("CPC");
      expect(result.beginningYear).toBe(2015);
      expect(result.endingYear).toBe(2024);
      expect(result.metricMode).toBe("total");
    });

    it("maps per-capita metric correctly", () => {
      const result = convertToMapFilters({ metric: "perCapitaAmount" });
      expect(result.metricMode).toBe("per_capita");
    });

    it("defaults partyCode to ALL when no parties given", () => {
      const result = convertToMapFilters({});
      expect(result.partyCode).toBe("ALL");
    });
  });

  describe("getProvinceCode", () => {
    it("returns the region code for a province", () => {
      expect(
        getProvinceCode({ regionLevel: "province", regionCode: "ON" })
      ).toBe("ON");
    });

    it("returns the province code for a riding", () => {
      expect(
        getProvinceCode({ regionLevel: "riding", provinceCode: "AB" })
      ).toBe("AB");
    });

    it("returns null for national level", () => {
      expect(getProvinceCode({ regionLevel: "national" })).toBe(null);
    });
  });

  describe("getRidingCode", () => {
    it("returns the riding code for a riding level", () => {
      expect(
        getRidingCode({ regionLevel: "riding", regionCode: "35001" })
      ).toBe("35001");
    });

    it("returns null for non-riding levels", () => {
      expect(getRidingCode({ regionLevel: "province" })).toBe(null);
    });
  });
});