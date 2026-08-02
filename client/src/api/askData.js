import { API_BASE } from "./config";

export async function askQuestion({ question, currentFilters, previousQuery }) {
  const res = await fetch(`${API_BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      currentFilters: currentFilters || null,
      previousQuery: previousQuery || null,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw Object.assign(new Error(data.message || "Failed to process the question."), {
      status: res.status,
      supported: data.supported,
    });
  }

  return data;
}