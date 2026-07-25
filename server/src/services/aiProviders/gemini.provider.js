const AIProviderError = require("./providerError");

function createGeminiProvider({
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const apiKey = env.AI_API_KEY;
  const model = env.AI_MODEL;
  const baseUrl =
    env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
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

  const endpoint =
    `${String(baseUrl).replace(/\/$/, "")}/models/`
    + `${encodeURIComponent(model)}:generateContent`;

  return {
    async generateJson({ systemPrompt, userPrompt, jsonSchema }) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: userPrompt }],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              responseJsonSchema: jsonSchema,
              temperature: 0,
            },
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
        const content = body?.candidates?.[0]?.content?.parts?.find(
          (part) => typeof part?.text === "string",
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
  createGeminiProvider,
};
