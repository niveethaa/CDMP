jest.mock(
  "../src/services/aiProviders/openAiCompatible.provider",
  () => ({
    createOpenAICompatibleProvider: jest.fn(),
  }),
);
jest.mock("../src/services/aiProviders/anthropic.provider", () => ({
  createAnthropicProvider: jest.fn(),
}));
jest.mock("../src/services/aiProviders/gemini.provider", () => ({
  createGeminiProvider: jest.fn(),
}));

const {
  createOpenAICompatibleProvider,
} = require("../src/services/aiProviders/openAiCompatible.provider");
const {
  createAnthropicProvider,
} = require("../src/services/aiProviders/anthropic.provider");
const {
  createGeminiProvider,
} = require("../src/services/aiProviders/gemini.provider");
const {
  createAIProvider,
} = require("../src/services/aiProviders/providerFactory");

describe("AI provider factory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates the configured OpenAI-compatible provider", () => {
    const expectedProvider = { generateJson: jest.fn() };
    const env = {
      AI_PROVIDER: "OPENAI-COMPATIBLE",
      AI_API_KEY: "test-key",
      AI_MODEL: "test-model",
      AI_BASE_URL: "https://model.example/v1",
    };
    const fetchImpl = jest.fn();
    createOpenAICompatibleProvider.mockReturnValue(expectedProvider);

    expect(createAIProvider({ env, fetchImpl })).toBe(expectedProvider);
    expect(createOpenAICompatibleProvider).toHaveBeenCalledWith({
      env,
      fetchImpl,
    });
  });

  it("creates the configured Anthropic provider", () => {
    const expectedProvider = { generateJson: jest.fn() };
    const env = {
      AI_PROVIDER: "ANTHROPIC",
      AI_API_KEY: "test-key",
      AI_MODEL: "test-model",
    };
    const fetchImpl = jest.fn();
    createAnthropicProvider.mockReturnValue(expectedProvider);

    expect(createAIProvider({ env, fetchImpl })).toBe(expectedProvider);
    expect(createAnthropicProvider).toHaveBeenCalledWith({
      env,
      fetchImpl,
    });
  });

  it("creates the configured Gemini provider", () => {
    const expectedProvider = { generateJson: jest.fn() };
    const env = {
      AI_PROVIDER: "GEMINI",
      AI_API_KEY: "test-key",
      AI_MODEL: "test-model",
    };
    const fetchImpl = jest.fn();
    createGeminiProvider.mockReturnValue(expectedProvider);

    expect(createAIProvider({ env, fetchImpl })).toBe(expectedProvider);
    expect(createGeminiProvider).toHaveBeenCalledWith({
      env,
      fetchImpl,
    });
  });

  it("rejects missing provider configuration", () => {
    expect(() => createAIProvider({ env: {} })).toThrow(
      expect.objectContaining({
        code: "MISSING_CONFIGURATION",
      }),
    );
  });

  it("rejects unsupported providers", () => {
    expect(() =>
      createAIProvider({
        env: { AI_PROVIDER: "unsupported-provider" },
      }),
    ).toThrow(
      expect.objectContaining({
        code: "UNSUPPORTED_PROVIDER",
      }),
    );
  });
});
