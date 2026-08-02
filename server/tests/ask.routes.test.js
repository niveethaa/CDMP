const request = require("supertest");

// Mock the three services the route orchestrates, so no real AI calls happen.
jest.mock("../src/services/askDataInterpreter.service", () => {
  class AskDataInterpreterError extends Error {
    constructor(message, code) {
      super(message);
      this.code = code;
    }
  }
  return {
    interpretQuestion: jest.fn(),
    AskDataInterpreterError,
  };
});
jest.mock("../src/services/askDataExecutor.service", () => ({
  executeQuerySpec: jest.fn(),
}));
jest.mock("../src/services/askDataFormatter.service", () => ({
  formatAnswer: jest.fn(() => "A plain-language answer."),
}));

const app = require("../src/app");
const {
  interpretQuestion,
  AskDataInterpreterError,
} = require("../src/services/askDataInterpreter.service");
const { executeQuerySpec } = require("../src/services/askDataExecutor.service");

const fakeQuerySpec = { type: "summary", groupBy: "party" };
const fakeResult = {
  query: "aggregate party summary",
  columns: ["party", "total"],
  rows: [{ party: "CPC", total: 1000 }],
  coverage: { years: "1993-2024" },
};

describe("POST /api/ask (Use Case 6)", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("input validation", () => {
    it("returns 400 when no question is provided", async () => {
      const res = await request(app).post("/api/ask").send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/question is required/i);
    });

    it("returns 400 when the question is empty", async () => {
      const res = await request(app).post("/api/ask").send({ question: "   " });
      expect(res.status).toBe(400);
    });

    it("returns 400 when the question exceeds the length limit", async () => {
      const longQuestion = "a".repeat(501);
      const res = await request(app)
        .post("/api/ask")
        .send({ question: longQuestion });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/500 characters or fewer/i);
    });
  });

  describe("happy path", () => {
    it("returns 200 with answer, data, and interpreted filters", async () => {
      interpretQuestion.mockResolvedValue({
        supported: true,
        querySpec: fakeQuerySpec,
      });
      executeQuerySpec.mockResolvedValue(fakeResult);

      const res = await request(app)
        .post("/api/ask")
        .send({ question: "Which party raised the most?" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("answer");
      expect(res.body).toHaveProperty("data");
      expect(res.body.data).toHaveProperty("rows");
      expect(res.body).toHaveProperty("interpretedFilters");
    });
  });

  describe("exception flows", () => {
    it("returns 422 for an unsupported question (E1)", async () => {
      interpretQuestion.mockResolvedValue({
        supported: false,
        reason: "Outside supported aggregate queries.",
      });

      const res = await request(app)
        .post("/api/ask")
        .send({ question: "What is the weather today?" });

      expect(res.status).toBe(422);
      expect(res.body.supported).toBe(false);
    });

    it("returns 422 when the QuerySpec fails validation (E2)", async () => {
      interpretQuestion.mockRejectedValue(
        new AskDataInterpreterError("bad spec", "INVALID_MODEL_QUERY_SPEC")
      );

      const res = await request(app)
        .post("/api/ask")
        .send({ question: "Give me raw donor records." });

      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/could not be interpreted safely/i);
    });

    it("returns 400 for an invalid-question interpreter error", async () => {
      interpretQuestion.mockRejectedValue(
        new AskDataInterpreterError("empty", "INVALID_QUESTION")
      );

      const res = await request(app)
        .post("/api/ask")
        .send({ question: "???" });

      expect(res.status).toBe(400);
    });

    it("returns 503 when the AI provider is unavailable (E3)", async () => {
      interpretQuestion.mockRejectedValue(
        new AskDataInterpreterError("timeout", "PROVIDER_UNAVAILABLE")
      );

      const res = await request(app)
        .post("/api/ask")
        .send({ question: "Top parties in Ontario?" });

      expect(res.status).toBe(503);
      expect(res.body.message).toMatch(/temporarily unavailable/i);
    });

    it("returns 500 for an unexpected error", async () => {
      interpretQuestion.mockRejectedValue(new Error("boom"));

      const res = await request(app)
        .post("/api/ask")
        .send({ question: "Anything" });

      expect(res.status).toBe(500);
    });
  });

  describe("rate limiting", () => {
    it("returns 429 after too many requests", async () => {
      interpretQuestion.mockResolvedValue({
        supported: true,
        querySpec: fakeQuerySpec,
      });
      executeQuerySpec.mockResolvedValue(fakeResult);

      // The limit is 10/min per IP; fire 11 and expect the last to be blocked
      let lastStatus;
      for (let i = 0; i < 11; i++) {
        const res = await request(app)
          .post("/api/ask")
          .send({ question: "Which party raised the most?" });
        lastStatus = res.status;
      }
      expect(lastStatus).toBe(429);
    });
  });
});