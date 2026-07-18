import { API_BASE } from "./config";

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export async function fetchNationalStats(options = {}) {
  const res = await fetch(`${API_BASE}/regions/national${buildQuery(options)}`);
  if (!res.ok) throw new Error("Failed to fetch national stats");
  return res.json();
}

export async function fetchAllProvinceStats(options = {}) {
  const res = await fetch(`${API_BASE}/regions/provinces${buildQuery(options)}`);
  if (!res.ok) throw new Error("Failed to fetch province stats");
  return res.json();
}

export async function fetchRidingStatsByProvince(provinceCode, options = {}) {
  const res = await fetch(
    `${API_BASE}/regions/ridings/${provinceCode}${buildQuery(options)}`,
  );

  if (!res.ok) throw new Error(`Failed to fetch riding stats for ${provinceCode}`);
  return res.json();
}

export async function fetchRegionStats(level, code, options = {}) {
  const res = await fetch(
    `${API_BASE}/regions/${level}/${code}${buildQuery(options)}`,
  );

  if (!res.ok) throw new Error(`Failed to fetch stats for ${level} ${code}`);
  return res.json();
}
