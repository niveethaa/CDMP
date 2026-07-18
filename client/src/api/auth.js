const API_BASE = "http://localhost:5001/api";

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchMe() {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch account info");
  return res.json();
}

export async function changePassword(currentPassword, newPassword) {
  const res = await fetch(`${API_BASE}/auth/change-password`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to change password");
  return data;
}