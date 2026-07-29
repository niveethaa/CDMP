// Shared display formatting helpers. Kept in one place so currency and count
// formatting stays consistent across the map, summary panel, and dashboard.

export function formatDollars(amount) {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${Number(amount || 0).toFixed(0)}`;
}

export function formatCount(n) {
  return Number(n || 0).toLocaleString("en-CA");
}
