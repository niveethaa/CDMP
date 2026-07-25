const AIProviderError = require("./providerError");

function createOpenAICompatibleProvider({
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const apiKey = env.AI_API_KEY;
  const model = env.AI_MODEL;
  const baseUrl = env.AI_BASE_URL;
  const parsedTimeout = Number.parseInt(env.AI_REQUEST_TIMEOUT_MS, 10);
  const timeoutMs =
    Number.isInteger(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 15000;

  if (!apiKey || !model || !baseUrl) {
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

  const endpoint = `${String(baseUrl).replace(/\/$/, "")}/chat/completions`;

  return {
    async generateJson({ systemPrompt, userPrompt, jsonSchema }) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
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
        const content = body?.choices?.[0]?.message?.content;
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
  createOpenAICompatibleProvider,
};
