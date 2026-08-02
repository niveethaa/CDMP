const {
  createAnthropicProvider,
} = require("../src/services/aiProviders/anthropic.provider");

function providerEnv(overrides = {}) {
  return {
    AI_API_KEY: "test-key",
    AI_MODEL: "test-model",
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

describe("Anthropic provider", () => {
  it("translates unsupported schema constraints without changing the original", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        content: [{ type: "text", text: '{"supported":false}' }],
      }),
    });
    const jsonSchema = {
      type: "object",
      properties: {
        partyCodes: {
          type: "array",
          items: { type: "string" },
          maxItems: 2,
        },
        year: {
          type: "integer",
          description: "Donation year.",
          minimum: 1993,
          maximum: 2024,
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 5,
        },
      },
      required: ["partyCodes", "year", "limit"],
      additionalProperties: false,
    };
    const originalSchema = JSON.parse(JSON.stringify(jsonSchema));
    const provider = createAnthropicProvider({
      env: providerEnv(),
      fetchImpl,
    });

    await provider.generateJson({
      systemPrompt: "system",
      userPrompt: "user",
      jsonSchema,
    });

    const request = fetchImpl.mock.calls[0][1];
    const sentSchema =
      JSON.parse(request.body).output_config.format.schema;
    expect(sentSchema).toEqual({
      type: "object",
      properties: {
        partyCodes: {
          type: "array",
          items: { type: "string" },
          description: "Maximum items: 2.",
        },
        year: {
          type: "integer",
          description:
            "Donation year. Minimum value: 1993. Maximum value: 2024.",
        },
        limit: {
          type: "integer",
          description: "Minimum value: 1. Maximum value: 5.",
        },
      },
      required: ["partyCodes", "year", "limit"],
      additionalProperties: false,
    });
    expect(jsonSchema).toEqual(originalSchema);
  });

  it("returns structured Claude content", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        content: [
          {
            type: "text",
            text: '{"supported":false}',
          },
        ],
      }),
    });
    const provider = createAnthropicProvider({
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
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: {
          "x-api-key": "test-key",
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
      }),
    );

    const request = fetchImpl.mock.calls[0][1];
    expect(JSON.parse(request.body)).toEqual({
      model: "test-model",
      max_tokens: 1024,
      system: "system",
      messages: [{ role: "user", content: "user" }],
      output_config: {
        format: {
          type: "json_schema",
          schema: jsonSchema,
        },
      },
      temperature: 0,
    });
  });

  it("supports a custom base URL", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        content: [{ type: "text", text: "{}" }],
      }),
    });
    const provider = createAnthropicProvider({
      env: providerEnv({ AI_BASE_URL: "https://gateway.example/anthropic/" }),
      fetchImpl,
    });

    await provider.generateJson({
      systemPrompt: "system",
      userPrompt: "user",
      jsonSchema: outputSchema(),
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://gateway.example/anthropic/v1/messages",
      expect.any(Object),
    );
  });

  it("rejects missing provider settings", () => {
    expect(() =>
      createAnthropicProvider({
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
    const provider = createAnthropicProvider({
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
    const provider = createAnthropicProvider({
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

  it("rejects malformed Claude response shapes", async () => {
    const provider = createAnthropicProvider({
      env: providerEnv(),
      fetchImpl: jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ content: [] }),
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
