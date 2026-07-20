const request = require("supertest");

// Mock the service layer so these tests never touch MongoDB.
// We control what each service returns, then assert how the routes behave.
jest.mock("../src/services/regionStats.service", () => ({
  getNationalStats: jest.fn(),
  getAllProvinceStats: jest.fn(),
  getRegionStats: jest.fn(),
  getRidingStatsForProvince: jest.fn(),
}));

const app = require("../src/app");
const {
  getNationalStats,
  getAllProvinceStats,
  getRegionStats,
  getRidingStatsForProvince,
} = require("../src/services/regionStats.service");

const fakeStat = {
  region: { level: "national", code: "CA", name: "Canada" },
  totals: { totalDonations: 1000, donationCount: 4, donorCount: 4 },
  partyStats: [{ partyCode: "CPC", totalDonations: 600 }],
  donationsTrend: [{ year: 2024, totalDonations: 1000 }],
  privacy: { isSuppressed: false },
};

describe("Region API routes (UC1/UC2)", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("GET /api/regions/national", () => {
    it("returns 200 with national stats (happy path)", async () => {
      getNationalStats.mockResolvedValue(fakeStat);
      const res = await request(app).get("/api/regions/national");
      expect(res.status).toBe(200);
      expect(res.body.region.code).toBe("CA");
    });

    it("passes query params through to the service", async () => {
      getNationalStats.mockResolvedValue(fakeStat);
      await request(app).get(
        "/api/regions/national?partyCode=CPC&beginningYear=2015&endingYear=2024&metricMode=per_capita"
      );
      expect(getNationalStats).toHaveBeenCalledWith(
        expect.objectContaining({
          partyCode: "CPC",
          beginningYear: "2015",
          endingYear: "2024",
          metricMode: "per_capita",
        })
      );
    });

    it("returns 404 when national stats are missing", async () => {
      getNationalStats.mockResolvedValue(null);
      const res = await request(app).get("/api/regions/national");
      expect(res.status).toBe(404);
    });

    it("returns 500 when the service throws", async () => {
      getNationalStats.mockRejectedValue(new Error("DB down"));
      const res = await request(app).get("/api/regions/national");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /api/regions/provinces", () => {
    it("returns 200 with an array of province stats", async () => {
      getAllProvinceStats.mockResolvedValue([fakeStat]);
      const res = await request(app).get("/api/regions/provinces");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("GET /api/regions/ridings/:provinceCode", () => {
    it("returns 200 with riding stats for a province", async () => {
      getRidingStatsForProvince.mockResolvedValue([fakeStat]);
      const res = await request(app).get("/api/regions/ridings/ON");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("passes the boundarySet query param through", async () => {
      getRidingStatsForProvince.mockResolvedValue([fakeStat]);
      await request(app).get(
        "/api/regions/ridings/ON?boundarySet=federal_ridings_2013"
      );
      expect(getRidingStatsForProvince).toHaveBeenCalledWith(
        "ON",
        expect.objectContaining({ boundarySet: "federal_ridings_2013" })
      );
    });
  });

  describe("GET /api/regions/:level/:code", () => {
    it("returns 200 for a valid province request", async () => {
      getRegionStats.mockResolvedValue(fakeStat);
      const res = await request(app).get("/api/regions/province/ON");
      expect(res.status).toBe(200);
      expect(getRegionStats).toHaveBeenCalledWith(
        "province",
        "ON",
        expect.any(Object)
      );
    });

    it("returns 200 for a valid riding request", async () => {
      getRegionStats.mockResolvedValue(fakeStat);
      const res = await request(app).get("/api/regions/riding/35001");
      expect(res.status).toBe(200);
    });

    it("returns 400 for an invalid region level", async () => {
      const res = await request(app).get("/api/regions/banana/ON");
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid region level/i);
    });

    it("returns 404 when the region has no stats", async () => {
      getRegionStats.mockResolvedValue(null);
      const res = await request(app).get("/api/regions/province/ZZ");
      expect(res.status).toBe(404);
    });
  });
});