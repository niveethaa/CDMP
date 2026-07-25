const AIProviderError = require("./providerError");

function createAnthropicProvider({
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const apiKey = env.AI_API_KEY;
  const model = env.AI_MODEL;
  const baseUrl = env.AI_BASE_URL || "https://api.anthropic.com";
  const parsedTimeout = Number.parseInt(env.AI_REQUEST_TIMEOUT_MS, 10);
  const timeoutMs =
    Number.isInteger(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 15000;

  if (!apiKey || !model) {
    throw new AIProviderError(
      "MISSING_CONFIGURATION",
      "Ask CDMP model configuration is incomplete.",
    );
  }
  if (typeof fetchImpl !== "function") {
    throw new AIProviderError(
      "MISSING_CONFIGURATION",
      "No HTTP client is available for the Ask CDMP model provider.",
    );
  }

  const endpoint = `${String(baseUrl).replace(/\/$/, "")}/v1/messages`;

  return {
    async generateJson({ systemPrompt, userPrompt, jsonSchema }) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
            output_config: {
              format: {
                type: "json_schema",
                schema: jsonSchema,
              },
            },
            temperature: 0,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new AIProviderError(
            "PROVIDER_ERROR",
            "The Ask CDMP model provider could not process the request.",
          );
        }

        const body = await response.json();
        const content = body?.content?.find(
          (item) => item?.type === "text",
        )?.text;
        if (typeof content !== "string") {
          throw new AIProviderError(
            "MALFORMED_MODEL_RESPONSE",
            "The model returned an invalid response.",
          );
        }
        return content;
      } catch (error) {
        if (error?.name === "AbortError") {
          throw new AIProviderError(
            "PROVIDER_TIMEOUT",
            "The Ask CDMP model request timed out.",
          );
        }
        if (error instanceof AIProviderError) throw error;
        throw new AIProviderError(
          "PROVIDER_ERROR",
          "The Ask CDMP model provider is unavailable.",
        );
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

module.exports = {
  createAnthropicProvider,
};
