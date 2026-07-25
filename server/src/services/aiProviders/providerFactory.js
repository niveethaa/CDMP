const AIProviderError = require("./providerError");
const {
  createOpenAICompatibleProvider,
} = require("./openAiCompatible.provider");
const {
  createAnthropicProvider,
} = require("./anthropic.provider");
const {
  createGeminiProvider,
} = require("./gemini.provider");

function createAIProvider({
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const providerName = String(env.AI_PROVIDER || "").trim().toLowerCase();

  if (!providerName) {
    throw new AIProviderError(
      "MISSING_CONFIGURATION",
      "Ask CDMP provider configuration is incomplete.",
    );
  }

  if (providerName === "openai-compatible") {
    return createOpenAICompatibleProvider({ env, fetchImpl });
  }
  if (providerName === "anthropic") {
    return createAnthropicProvider({ env, fetchImpl });
  }
  if (providerName === "gemini") {
    return createGeminiProvider({ env, fetchImpl });
  }

  throw new AIProviderError(
    "UNSUPPORTED_PROVIDER",
    "The configured Ask CDMP model provider is not supported.",
  );
}

module.exports = {
  createAIProvider,
};
