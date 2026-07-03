import { describe, it, expect, afterEach, vi } from "vitest";
import {
  fetchNationalStats,
  fetchAllProvinceStats,
  fetchRidingStatsByProvince,
  fetchRegionStats,
} from "./regions";

// Replace global.fetch with a fake that returns a controlled response.
function mockFetchOnce(body, ok = true, status = 200) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

const fakeStat = {
  region: { level: "national", code: "CA", name: "Canada" },
  totals: { totalDonations: 1000 },
};

describe("regions API client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchNationalStats", () => {
    it("calls the national endpoint and returns parsed JSON", async () => {
      mockFetchOnce(fakeStat);
      const result = await fetchNationalStats();
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5001/api/regions/national"
      );
      expect(result).toEqual(fakeStat);
    });

    it("appends query params when options are passed", async () => {
      mockFetchOnce(fakeStat);
      await fetchNationalStats({ partyCode: "CPC", beginningYear: 2015 });
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5001/api/regions/national?partyCode=CPC&beginningYear=2015"
      );
    });

    it("throws when the response is not ok", async () => {
      mockFetchOnce({}, false, 500);
      await expect(fetchNationalStats()).rejects.toThrow(
        /failed to fetch national stats/i
      );
    });
  });

  describe("fetchAllProvinceStats", () => {
    it("calls the provinces endpoint and returns parsed JSON", async () => {
      mockFetchOnce([fakeStat]);
      const result = await fetchAllProvinceStats();
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5001/api/regions/provinces"
      );
      expect(result).toEqual([fakeStat]);
    });

    it("throws on a failed response", async () => {
      mockFetchOnce({}, false, 500);
      await expect(fetchAllProvinceStats()).rejects.toThrow(
        /failed to fetch province stats/i
      );
    });
  });

  describe("fetchRidingStatsByProvince", () => {
    it("builds the correct riding URL with the province code", async () => {
      mockFetchOnce([fakeStat]);
      await fetchRidingStatsByProvince("ON", {
        boundarySet: "federal_ridings_2013",
      });
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5001/api/regions/ridings/ON?boundarySet=federal_ridings_2013"
      );
    });

    it("throws with the province code in the message on failure", async () => {
      mockFetchOnce({}, false, 500);
      await expect(fetchRidingStatsByProvince("ON")).rejects.toThrow(
        /failed to fetch riding stats for ON/i
      );
    });
  });

  describe("fetchRegionStats", () => {
    it("builds the correct URL from level and code", async () => {
      mockFetchOnce(fakeStat);
      const result = await fetchRegionStats("province", "AB");
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5001/api/regions/province/AB"
      );
      expect(result).toEqual(fakeStat);
    });

    it("throws with level and code in the message on failure", async () => {
      mockFetchOnce({}, false, 404);
      await expect(fetchRegionStats("province", "ZZ")).rejects.toThrow(
        /failed to fetch stats for province ZZ/i
      );
    });
  });
});