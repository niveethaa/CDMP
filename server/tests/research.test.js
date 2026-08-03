const request = require("supertest");
const jwt = require("jsonwebtoken");
// Ensure a secret exists for signing test tokens (matches the middleware).
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
// Mock the DB models so these tests never touch MongoDB.
jest.mock("../src/models/Donation", () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
  estimatedDocumentCount: jest.fn(),
  aggregate: jest.fn(),
}));
jest.mock("../src/models/ActivityLog", () => ({
  create: jest.fn().mockResolvedValue({}),
}));
const app = require("../src/app");
const Donation = require("../src/models/Donation");
function researcherToken() {
  return jwt.sign(
    { userId: "u1", email: "r@utoronto.ca", role: "researcher" },
    process.env.JWT_SECRET
  );
}
function nonResearcherToken() {
  return jwt.sign(
    { userId: "u2", email: "x@utoronto.ca", role: "user" },
    process.env.JWT_SECRET
  );
}
// Chainable mock for Donation.find().select().skip().limit().lean()
function mockFindReturns(records) {
  const chain = {
    select: () => chain,
    skip: () => chain,
    limit: () => chain,
    lean: () => Promise.resolve(records),
  };
  Donation.find.mockReturnValue(chain);
  Donation.countDocuments.mockResolvedValue(records.length);
  Donation.estimatedDocumentCount.mockResolvedValue(records.length);
}
describe("Research API access control (UC3)", () => {
  beforeEach(() => jest.clearAllMocks());
  describe("GET /api/research/donations — access control", () => {
    it("returns 401 when no token is provided", async () => {
      const res = await request(app).get("/api/research/donations");
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/no token/i);
    });
    it("returns 401 for an invalid token", async () => {
      const res = await request(app)
        .get("/api/research/donations")
        .set("Authorization", "Bearer not-a-real-token");
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid or expired/i);
    });
    it("returns 403 for a valid token that is not a researcher", async () => {
      const res = await request(app)
        .get("/api/research/donations")
        .set("Authorization", `Bearer ${nonResearcherToken()}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/forbidden/i);
    });
    it("returns 200 and paginated records for a researcher", async () => {
      mockFindReturns([
        { party: { code: "CPC" }, contribution: { amountTotal: 300 } },
      ]);
      const res = await request(app)
        .get("/api/research/donations")
        .set("Authorization", `Bearer ${researcherToken()}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("donations");
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("totalPages");
      expect(Donation.estimatedDocumentCount).toHaveBeenCalled();
      expect(Donation.countDocuments).not.toHaveBeenCalled();
    });

    it("uses an exact count when filters are applied", async () => {
      mockFindReturns([
        { party: { code: "CPC" }, contribution: { amountTotal: 300 } },
      ]);

      const res = await request(app)
        .get("/api/research/donations?year=2023")
        .set("Authorization", `Bearer ${researcherToken()}`);

      expect(res.status).toBe(200);
      expect(Donation.countDocuments).toHaveBeenCalledWith({ "source.year": 2023 });
      expect(Donation.estimatedDocumentCount).not.toHaveBeenCalled();
    });
  });
  describe("GET /api/research/donations/export — access control", () => {
    it("returns 401 when no token is provided", async () => {
      const res = await request(app).get("/api/research/donations/export");
      expect(res.status).toBe(401);
    });
    it("returns 403 for a non-researcher", async () => {
      const res = await request(app)
        .get("/api/research/donations/export")
        .set("Authorization", `Bearer ${nonResearcherToken()}`);
      expect(res.status).toBe(403);
    });
    it("returns CSV for an authorized researcher", async () => {
      mockFindReturns([
        {
          donor: { donorLastName: "Smith", postalCode: "M5S" },
          party: { code: "CPC" },
          contribution: { amountTotal: 300, dateReceived: "2020-01-01" },
          geography: { ridingName: "Toronto Centre", provinceCode: "ON" },
        },
      ]);
      const res = await request(app)
        .get("/api/research/donations/export")
        .set("Authorization", `Bearer ${researcherToken()}`);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/csv/);
      expect(res.text).toMatch(/Donor,Party,Amount/);
    });
  });
  describe("GET /api/research/analytics — access control + shape", () => {
    // The route runs two Donation.aggregate() calls via Promise.all,
    // each ending in .allowDiskUse(). Mock returns fake aggregation results.
    function mockAggregateReturns(topRidings, amountDistribution) {
      Donation.aggregate
        .mockReturnValueOnce({ allowDiskUse: () => Promise.resolve(topRidings) })
        .mockReturnValueOnce({ allowDiskUse: () => Promise.resolve(amountDistribution) });
    }

    it("returns 401 when no token is provided", async () => {
      const res = await request(app).get("/api/research/analytics");
      expect(res.status).toBe(401);
    });

    it("returns 403 for a non-researcher", async () => {
      const res = await request(app)
        .get("/api/research/analytics")
        .set("Authorization", `Bearer ${nonResearcherToken()}`);
      expect(res.status).toBe(403);
    });

    it("returns 200 with topRidings and amountDistribution for a researcher", async () => {
      mockAggregateReturns(
        [{ _id: "Toronto Centre", donationCount: 500, totalDonations: 100000 }],
        [{ _id: 0, count: 200, total: 5000 }]
      );

      const res = await request(app)
        .get("/api/research/analytics?year=2023")
        .set("Authorization", `Bearer ${researcherToken()}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("topRidings");
      expect(res.body).toHaveProperty("amountDistribution");
      expect(res.body.topRidings[0]._id).toBe("Toronto Centre");
    });

    it("rejects analytics without a selected year", async () => {
      const res = await request(app)
        .get("/api/research/analytics")
        .set("Authorization", `Bearer ${researcherToken()}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/select a year/i);
      expect(Donation.aggregate).not.toHaveBeenCalled();
    });
  });

  // Regression tests for the critical privacy-agreement bypass: a token issued
  // at login before the user accepted the privacy agreement carries the
  // "researcher" role but must NOT be able to reach individual records.
  describe("pre-privacy-agreement token is blocked (UC3)", () => {
    function preAgreementToken() {
      return jwt.sign(
        {
          userId: "u3",
          email: "r@utoronto.ca",
          role: "researcher",
          requiresPrivacyAgreement: true,
        },
        process.env.JWT_SECRET
      );
    }

    it("returns 403 on /donations for a pre-agreement token", async () => {
      const res = await request(app)
        .get("/api/research/donations")
        .set("Authorization", `Bearer ${preAgreementToken()}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/privacy agreement/i);
    });

    it("returns 403 on /donations/export for a pre-agreement token", async () => {
      const res = await request(app)
        .get("/api/research/donations/export")
        .set("Authorization", `Bearer ${preAgreementToken()}`);
      expect(res.status).toBe(403);
    });

    it("returns 403 on /analytics for a pre-agreement token", async () => {
      const res = await request(app)
        .get("/api/research/analytics")
        .set("Authorization", `Bearer ${preAgreementToken()}`);
      expect(res.status).toBe(403);
    });
  });
});
