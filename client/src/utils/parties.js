// Canonical party list and display names, shared by the filters, public map,
// and research dashboard so party labels never drift between views.

export const PARTIES = [
  { code: "ALL", name: "All Parties" },
  { code: "LPC", name: "Liberal" },
  { code: "CPC", name: "Conservative" },
  { code: "NDP", name: "NDP" },
  { code: "BQ", name: "Bloc Québécois" },
  { code: "GPC", name: "Green" },
  { code: "PPC", name: "People's Party" },
];

export const PARTY_LABELS = Object.fromEntries(
  PARTIES.map((party) => [party.code, party.name]),
);
