function parseAmount(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const cleaned = String(value).replace(/[$,]/g, "").trim();

  const parsed = Number(cleaned);

  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return 0;
}

module.exports = parseAmount;
