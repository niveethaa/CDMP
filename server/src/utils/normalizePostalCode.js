function normalizePostalCode(value) {
  const postalCode = String(value || "")
    .replace(/\s+/g, "")
    .toUpperCase()
    .trim();

  let fsa = "";

  if (postalCode.length >= 3) {
    fsa = postalCode.slice(0, 3);
  }

  return {
    postalCode: postalCode,
    fsa: fsa,
  };
}

module.exports = normalizePostalCode;
