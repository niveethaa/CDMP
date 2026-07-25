const {
  createGeminiProvider,
} = require("../src/services/aiProviders/gemini.provider");

function providerEnv(overrides = {}) {
  return {
    AI_API_KEY: "test-key",
    AI_MODEL: "gemini-test-model",
    AI_REQUEST_TIMEOUT_MS: "15000",
    ...overrides,
  };
}

function outputSchema() {
  return {
    type: "object",
    properties: {
      supported: { type: "boolean" },
    },
    required: ["supported"],
    additionalProperties: false,
  };
}

describe("Gemini provider", () => {
  it("returns structured Gemini content", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [{ text: '{"supported":false}' }],
            },
          },
        ],
      }),
    });
    const provider = createGeminiProvider({
      env: providerEnv(),
      fetchImpl,
    });
    const jsonSchema = outputSchema();

    await expect(
      provider.generateJson({
        systemPrompt: "system",
        userPrompt: "user",
        jsonSchema,
      }),
    ).resolves.toBe('{"supported":false}');

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/"
        + "gemini-test-model:generateContent",
      expect.objectContaining({
        method: "POST",
        headers: {
          "x-goog-api-key": "test-key",
          "Content-Type": "application/json",
        },
      }),
    );

    const request = fetchImpl.mock.calls[0][1];
    expect(JSON.parse(request.body)).toEqual({
      systemInstruction: {
        parts: [{ text: "system" }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: "user" }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
        temperature: 0,
      },
    });
  });

  it("supports a custom base URL and safely encodes the model", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [{ text: "{}" }],
            },
          },
        ],
      }),
    });
    const provider = createGeminiProvider({
      env: providerEnv({
        AI_BASE_URL: "https://gateway.example/google/",
        AI_MODEL: "models/test model",
      }),
      fetchImpl,
    });

    await provider.generateJson({
      systemPrompt: "system",
      userPrompt: "user",
      jsonSchema: outputSchema(),
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://gateway.example/google/models/models%2Ftest%20model"
        + ":generateContent",
      expect.any(Object),
    );
  });

  it("rejects missing provider settings", () => {
    expect(() =>
      createGeminiProvider({
        env: {},
        fetchImpl: jest.fn(),
      }),
    ).toThrow(
      expect.objectContaining({
        code: "MISSING_CONFIGURATION",
      }),
    );
  });

  it("converts provider failures into controlled errors", async () => {
    const provider = createGeminiProvider({
      env: providerEnv(),
      fetchImpl: jest.fn().mockResolvedValue({ ok: false, status: 500 }),
    });

    await expect(
      provider.generateJson({
        systemPrompt: "system",
        userPrompt: "user",
        jsonSchema: outputSchema(),
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
    });
  });

  it("converts timeouts into controlled errors", async () => {
    const timeoutError = new Error("aborted");
    timeoutError.name = "AbortError";
    const provider = createGeminiProvider({
      env: providerEnv({ AI_REQUEST_TIMEOUT_MS: "10" }),
      fetchImpl: jest.fn().mockRejectedValue(timeoutError),
    });

    await expect(
      provider.generateJson({
        systemPrompt: "system",
        userPrompt: "user",
        jsonSchema: outputSchema(),
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_TIMEOUT",
    });
  });

  it("rejects malformed Gemini response shapes", async () => {
    const provider = createGeminiProvider({
      env: providerEnv(),
      fetchImpl: jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ candidates: [] }),
      }),
    });

    await expect(
      provider.generateJson({
        systemPrompt: "system",
        userPrompt: "user",
        jsonSchema: outputSchema(),
      }),
    ).rejects.toMatchObject({
      code: "MALFORMED_MODEL_RESPONSE",
    });
  });
});
