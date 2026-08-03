import { describe, it, expect, afterEach, jest } from "@jest/globals";
import { askQuestion } from "./askData";

function mockFetchOnce(body, ok = true, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("askData API client", () => {
  it("POSTs the question to /ask and returns the parsed answer", async () => {
    mockFetchOnce({ answer: "CPC raised the most.", data: { rows: [] } });

    const result = await askQuestion({ question: "Who raised the most?" });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:5001/api/ask",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          question: "Who raised the most?",
          currentFilters: null,
          previousQuery: null,
        }),
      })
    );
    expect(result.answer).toMatch(/CPC/);
  });

  it("passes currentFilters and previousQuery when provided", async () => {
    mockFetchOnce({ answer: "ok" });

    await askQuestion({
      question: "and in Ontario?",
      currentFilters: { province: "ON" },
      previousQuery: { type: "summary" },
    });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.currentFilters).toEqual({ province: "ON" });
    expect(body.previousQuery).toEqual({ type: "summary" });
  });

  it("throws with the server message and status on failure", async () => {
    mockFetchOnce({ message: "The AI service is temporarily unavailable." }, false, 503);

    await expect(askQuestion({ question: "hi" })).rejects.toThrow(
      /temporarily unavailable/i
    );
  });

  it("attaches the supported flag on an unsupported-question error", async () => {
    mockFetchOnce({ message: "Unsupported.", supported: false }, false, 422);

    try {
      await askQuestion({ question: "weather?" });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err.status).toBe(422);
      expect(err.supported).toBe(false);
    }
  });
});