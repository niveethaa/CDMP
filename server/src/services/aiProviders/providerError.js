class AIProviderError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AIProviderError";
    this.code = code;
  }
}

module.exports = AIProviderError;
