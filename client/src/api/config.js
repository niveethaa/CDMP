const DEFAULT_API_BASE = "http://localhost:5001/api";

export const API_BASE = (
  typeof globalThis.__API_BASE_URL__ === "string"
    ? globalThis.__API_BASE_URL__
    : DEFAULT_API_BASE
).replace(/\/$/, "");
