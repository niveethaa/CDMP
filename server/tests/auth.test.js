const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.CLIENT_URL = "http://localhost:8080";
process.env.PASSWORD_RESET_PREVIEW = "true";

jest.mock("../src/models/User");
jest.mock("../src/models/ActivityLog", () => ({
  create: jest.fn().mockResolvedValue({}),
}));

const bcrypt = require("bcryptjs");
const app = require("../src/app");
const User = require("../src/models/User");

function token(overrides = {}) {
  return jwt.sign(
    { userId: "u1", email: "r@utoronto.ca", role: "researcher", ...overrides },
    process.env.JWT_SECRET
  );
}

describe("Auth account routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PASSWORD_RESET_PREVIEW = "true";
  });

  describe("POST /api/auth/register", () => {
    it("creates an account for an allowed email domain", async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({ _id: "u1", email: "grad@mail.utoronto.ca" });
      jest.spyOn(bcrypt, "hash").mockResolvedValue("hashed");

      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "grad@mail.utoronto.ca", password: "password12" });

      expect(res.status).toBe(201);
      expect(User.create).toHaveBeenCalled();
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

  describe("POST /api/auth/login", () => {
    it("returns a token for valid credentials", async () => {
      User.findOne.mockResolvedValue({
        _id: "u1",
        email: "grad@mail.utoronto.ca",
        password: "hashed",
        role: "researcher",
      });
      jest.spyOn(bcrypt, "compare").mockResolvedValue(true);

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "grad@mail.utoronto.ca", password: "password12" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
    });

    it("returns 401 for wrong password", async () => {
      User.findOne.mockResolvedValue({
        _id: "u1",
        email: "grad@mail.utoronto.ca",
        password: "hashed",
      });
      jest.spyOn(bcrypt, "compare").mockResolvedValue(false);

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "grad@mail.utoronto.ca", password: "wrongpass" });

      expect(res.status).toBe(401);
    });
  });

  describe("password reset", () => {
    it("returns a short-lived reset link in preview mode", async () => {
      User.findOne.mockResolvedValue({
        _id: "u1",
        email: "grad@mail.utoronto.ca",
        password: "hashed-old",
      });

      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "grad@mail.utoronto.ca" });

      expect(res.status).toBe(200);
      expect(res.body.resetUrl).toMatch(/^http:\/\/localhost:8080\/reset-password\?token=/);
    });

    it("does not reveal whether an unknown account exists", async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "unknown@mail.utoronto.ca" });

      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty("resetUrl");
    });

    it("does not return a reset link when preview mode is disabled", async () => {
      process.env.PASSWORD_RESET_PREVIEW = "false";
      User.findOne.mockResolvedValue({
        _id: "u1",
        email: "grad@mail.utoronto.ca",
        password: "hashed-old",
      });

      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "grad@mail.utoronto.ca" });

      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty("resetUrl");
    });

    it("resets the password once and invalidates the used link", async () => {
      const user = {
        _id: "u1",
        email: "grad@mail.utoronto.ca",
        password: "hashed-old",
        save: jest.fn().mockResolvedValue({}),
      };
      User.findOne.mockResolvedValue(user);

      const forgot = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: user.email });
      const resetToken = new URL(forgot.body.resetUrl).searchParams.get("token");

      User.findById.mockResolvedValue(user);
      jest.spyOn(bcrypt, "hash").mockResolvedValue("hashed-new");

      const firstReset = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: resetToken, newPassword: "newpass12" });
      const reusedReset = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: resetToken, newPassword: "another12" });

      expect(firstReset.status).toBe(200);
      expect(user.password).toBe("hashed-new");
      expect(user.save).toHaveBeenCalledTimes(1);
      expect(reusedReset.status).toBe(400);
    });
  });

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
});
