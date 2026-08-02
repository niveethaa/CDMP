const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

jest.mock("../src/models/User");
jest.mock("../src/models/ActivityLog", () => ({
  create: jest.fn().mockResolvedValue({}),
}));
// Mock the email service so tests never try to send real email.
jest.mock("../src/services/email.service", () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

const bcrypt = require("bcryptjs");
const app = require("../src/app");
const User = require("../src/models/User");
const { sendVerificationEmail } = require("../src/services/email.service");

function token(overrides = {}) {
  return jwt.sign(
    { userId: "u1", email: "r@utoronto.ca", role: "researcher", ...overrides },
    process.env.JWT_SECRET
  );
}

describe("Auth account routes", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("GET /api/auth/me", () => {
    it("returns 401 without a token", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });

    it("returns account info for an authenticated user", async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          email: "r@utoronto.ca",
          role: "researcher",
          createdAt: new Date("2024-01-01"),
        }),
      });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe("r@utoronto.ca");
      expect(res.body.role).toBe("researcher");
    });

    it("returns 404 when the user no longer exists", async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token()}`);

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/auth/change-password", () => {
    it("returns 401 without a token", async () => {
      const res = await request(app)
        .put("/api/auth/change-password")
        .send({ currentPassword: "old", newPassword: "newpass12" });
      expect(res.status).toBe(401);
    });

    it("returns 400 when fields are missing", async () => {
      const res = await request(app)
        .put("/api/auth/change-password")
        .set("Authorization", `Bearer ${token()}`)
        .send({ currentPassword: "old" });
      expect(res.status).toBe(400);
    });

    it("returns 400 when the new password is too short", async () => {
      const res = await request(app)
        .put("/api/auth/change-password")
        .set("Authorization", `Bearer ${token()}`)
        .send({ currentPassword: "oldpass12", newPassword: "short" });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/at least 8/i);
    });

    it("returns 401 when the current password is wrong", async () => {
      User.findById.mockResolvedValue({
        _id: "u1",
        email: "r@utoronto.ca",
        password: "hashed-old",
      });
      jest.spyOn(bcrypt, "compare").mockResolvedValue(false);

      const res = await request(app)
        .put("/api/auth/change-password")
        .set("Authorization", `Bearer ${token()}`)
        .send({ currentPassword: "wrongpass", newPassword: "newpass12" });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/incorrect/i);
    });

    it("updates the password when the current password is correct", async () => {
      const save = jest.fn().mockResolvedValue({});
      User.findById.mockResolvedValue({
        _id: "u1",
        email: "r@utoronto.ca",
        password: "hashed-old",
        save,
      });
      jest.spyOn(bcrypt, "compare").mockResolvedValue(true);
      jest.spyOn(bcrypt, "hash").mockResolvedValue("hashed-new");

      const res = await request(app)
        .put("/api/auth/change-password")
        .set("Authorization", `Bearer ${token()}`)
        .send({ currentPassword: "oldpass12", newPassword: "newpass12" });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/updated/i);
      expect(save).toHaveBeenCalled();
    });
  });

  describe("POST /api/auth/register — email verification (UC: secure registration)", () => {
    it("creates an unverified account and sends a verification email", async () => {
      User.findOne.mockResolvedValue(null); // no existing user
      User.create.mockResolvedValue({ _id: "u1", email: "grad@mail.utoronto.ca" });
      jest.spyOn(bcrypt, "hash").mockResolvedValue("hashed");

      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "grad@mail.utoronto.ca", password: "password12" });

      expect(res.status).toBe(201);
      expect(User.create).toHaveBeenCalled();
      expect(sendVerificationEmail).toHaveBeenCalled();
      // User is told to check their email
      expect(res.body.message).toMatch(/verif|check your email/i);
    });

    it("rejects a disallowed email domain", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "someone@gmail.com", password: "password12" });

      expect(res.status).toBe(403);
    });

    it("rejects registration when the email already exists", async () => {
      User.findOne.mockResolvedValue({ _id: "u1", email: "grad@mail.utoronto.ca" });

      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "grad@mail.utoronto.ca", password: "password12" });

      expect(res.status).toBe(409);
    });
  });

  describe("POST /api/auth/login — blocked until verified", () => {
    it("returns 403 when the account is not verified", async () => {
      User.findOne.mockResolvedValue({
        _id: "u1",
        email: "grad@mail.utoronto.ca",
        password: "hashed",
        isVerified: false,
      });
      jest.spyOn(bcrypt, "compare").mockResolvedValue(true);

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "grad@mail.utoronto.ca", password: "password12" });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/verify your email/i);
    });
  });

  describe("GET /api/auth/verify-email", () => {
    it("verifies the account with a valid, unexpired token", async () => {
      const save = jest.fn().mockResolvedValue({});
      User.findOne.mockResolvedValue({
        _id: "u1",
        isVerified: false,
        verificationToken: "valid-token",
        verificationTokenExpires: new Date(Date.now() + 60 * 60 * 1000),
        save,
      });

      const res = await request(app).get("/api/auth/verify-email?token=valid-token");

      expect(res.status).toBe(302); // redirects to the app after verifying
      expect(save).toHaveBeenCalled();
    });

    it("rejects an invalid or unknown token", async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app).get("/api/auth/verify-email?token=nope");

      expect(res.status).toBe(400);
    });
  });
});