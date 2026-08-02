/// <reference types="cypress" />

describe("Filters and boundary buckets (UC2)", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  // Helper: drill into a province so riding-view filters (boundary buckets) appear
  function drillIntoOntario() {
    cy.get('input[aria-label="Search region"]').type("Ontario");
    cy.contains(".search-dropdown li", "Ontario").click();
    cy.contains(".map-back-btn", /Back to National View/i).should("exist");
  }

  it("opens the filter panel in national view (custom years mode)", () => {
    cy.contains("button", "Filters").click();
    cy.contains(".filters-title", /Filter donations/i).should("exist");
    cy.contains(/National View Uses Custom Years/i).should("exist");
  });

  it("shows boundary-bucket options in riding view", () => {
    drillIntoOntario();
    cy.contains("button", "Filters").click();
    cy.contains(/Riding View Uses Boundary Buckets/i).should("exist");
    // The three data-bearing maps are shown as options
    cy.contains(".boundary-option", /1997–2003/).should("exist");
    cy.contains(".boundary-option", /2004–2014/).should("exist");
    cy.contains(".boundary-option", /2015–2024/).should("exist");
  });

  it("marks the 2025-onward bucket as unavailable and disabled", () => {
    drillIntoOntario();
    cy.contains("button", "Filters").click();
    // The 2023 map option is present but disabled, labelled unavailable
    cy.contains(".boundary-option", /2025 Onward/)
      .should("have.attr", "disabled");
    cy.contains(".boundary-option", /2025 Onward/)
      .should("contain.text", "unavailable");
  });

  it("switches boundary bucket and updates the year-range chip", () => {
    drillIntoOntario();
    cy.contains("button", "Filters").click();
    // Select the 1997–2003 (1996 map) bucket
    cy.contains(".boundary-option", /1997–2003/).click();
    cy.contains(".filters-btn", /Apply/i).click();
    // Year chip should now reflect 1997–2003
    cy.contains(".active-filter-chip", /1997–2003/).should("exist");
    // And the boundary-set short label chip updates to the 1996 map
    cy.contains(".active-filter-chip", /1996 Map/).should("exist");
  });

  it("applies a party filter and shows it as a chip", () => {
    cy.contains("button", "Filters").click();
    cy.get(".filters-select").first().select("Conservative");
    cy.contains(".filters-btn", /Apply/i).click();
    cy.contains(".active-filter-chip", /Conservative/i).should("exist");
  });

  it("resets filters back to defaults", () => {
    cy.contains("button", "Filters").click();
    cy.get(".filters-select").first().select("Liberal");
    cy.contains(".filters-btn", /Apply/i).click();
    cy.contains(".active-filter-chip", /Liberal/i).should("exist");

    // Reopen and reset
    cy.contains("button", "Filters").click();
    cy.contains(".filters-btn", /Reset/i).click();
    // Back to "All Parties" default — Liberal chip gone
    cy.contains(".active-filter-chip", /Liberal/i).should("not.exist");
  });

  it("active filter chips do not block the Filters button", () => {
    // Chips render in a bar; the Filters button must still be clickable
    cy.contains("button", "Filters").click();
    cy.contains(".filters-title", /Filter donations/i).should("exist");
  });
});