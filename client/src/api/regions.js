const API_BASE = "http://localhost:5001/api";

export async function fetchNationalStats() {
  const res = await fetch(`${API_BASE}/regions/national`);
  if (!res.ok) throw new Error("Failed to fetch national stats");
  return res.json();
}

export async function fetchAllProvinceStats() {
  const res = await fetch(`${API_BASE}/regions/provinces`);
  if (!res.ok) throw new Error("Failed to fetch province stats");
  return res.json();
}

export async function fetchRegionStats(level, code) {
  const res = await fetch(`${API_BASE}/regions/${level}/${code}`);
  if (!res.ok) throw new Error(`Failed to fetch stats for ${level} ${code}`);
  return res.json();
}