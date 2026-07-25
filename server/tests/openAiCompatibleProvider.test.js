const {
  createOpenAICompatibleProvider,
} = require("../src/services/aiProviders/openAiCompatible.provider");

function providerEnv(overrides = {}) {
  return {
    AI_API_KEY: "test-key",
    AI_MODEL: "test-model",
    AI_BASE_URL: "https://model.example/v1",
    AI_REQUEST_TIMEOUT_MS: "15000",
    ...overrides,
  };
}

describe("OpenAI-compatible provider", () => {
  it("returns structured model content", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: '{"supported":false}',
            },
          },
        ],
      }),
    });
    const provider = createOpenAICompatibleProvider({
      env: providerEnv(),
      fetchImpl,
    });
    const jsonSchema = {
      type: "object",
      properties: {
        supported: { type: "boolean" },
      },
      required: ["supported"],
      additionalProperties: false,
    };

    await expect(
      provider.generateJson({
        systemPrompt: "system",
        userPrompt: "user",
        jsonSchema,
      }),
    ).resolves.toBe('{"supported":false}');

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://model.example/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        },
      }),
    );

    const request = fetchImpl.mock.calls[0][1];
    expect(JSON.parse(request.body)).toEqual({
      model: "test-model",
      messages: [
        { role: "system", content: "system" },
        { role: "user", content: "user" },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ask_cdmp_query",
          strict: true,
          schema: jsonSchema,
        },
      },
      temperature: 0,
    });
  });

  it("rejects missing provider settings", () => {
    expect(() =>
      createOpenAICompatibleProvider({
        env: {},
        fetchImpl: jest.fn(),
      }),
    ).toThrow(
      expect.objectContaining({
        code: "MISSING_CONFIGURATION",
      }),
    );
  });

  it("converts provider HTTP failures into controlled errors", async () => {
    const provider = createOpenAICompatibleProvider({
      env: providerEnv(),
      fetchImpl: jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    });

    await expect(
      provider.generateJson({
        systemPrompt: "system",
        userPrompt: "user",
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
    });
  });

  it("converts provider timeouts into controlled errors", async () => {
    const timeoutError = new Error("aborted");
    timeoutError.name = "AbortError";
    const provider = createOpenAICompatibleProvider({
      env: providerEnv({ AI_REQUEST_TIMEOUT_MS: "10" }),
      fetchImpl: jest.fn().mockRejectedValue(timeoutError),
    });

    await expect(
      provider.generateJson({
        systemPrompt: "system",
        userPrompt: "user",
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_TIMEOUT",
    });
  });

  it("rejects malformed provider response shapes", async () => {
    const provider = createOpenAICompatibleProvider({
      env: providerEnv(),
      fetchImpl: jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ choices: [] }),
      }),
    });

    await expect(
      provider.generateJson({
        systemPrompt: "system",
        userPrompt: "user",
      }),
    ).rejects.toMatchObject({
      code: "MALFORMED_MODEL_RESPONSE",
    });
  });

  it("does not expose provider response bodies in HTTP errors", async () => {
    const provider = createOpenAICompatibleProvider({
      env: providerEnv(),
      fetchImpl: jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        body: "private provider response",
      }),
    });

    await expect(
      provider.generateJson({
        systemPrompt: "system",
        userPrompt: "user",
      }),
    ).rejects.not.toMatchObject({
      message: expect.stringContaining("private provider response"),
    });
  });
});
