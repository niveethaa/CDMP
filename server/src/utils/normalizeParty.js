function normalizeParty(value) {
  const name = String(value || "").trim();
  const lowerName = name.toLowerCase();

  let code = "UNKNOWN";

  if (lowerName.includes("liberal")) {
    code = "LPC";
  } else if (lowerName.includes("conservative")) {
    code = "CPC";
  } else if (
    lowerName.includes("new democratic") ||
    lowerName.includes("n.d.p")
  ) {
    code = "NDP";
  } else if (lowerName.includes("bloc")) {
    code = "BQ";
  } else if (lowerName.includes("green")) {
    code = "GPC";
  } else if (lowerName.includes("people")) {
    code = "PPC";
  }

  return {
    code: code,
    name: name,
  };
}

module.exports = normalizeParty;
