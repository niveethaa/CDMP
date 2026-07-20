/// <reference types="cypress" />

describe("Province-to-riding drilldown (UC1/UC2)", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("loads the national map and active filter chips", () => {
    // National view shows the Canada chip
    cy.get(".active-filters-bar").should("exist");
    cy.contains(".active-filter-chip", /Canada/i).should("exist");
  });

  it("drills into a province and shows the ridings view", () => {
    // Search for and select a province
    cy.get('input[aria-label="Search region"]').type("Ontario");
    cy.contains(".search-dropdown li", "Ontario").click();

    // Now in province view: back button + ridings chip appear
    cy.contains(".map-back-btn", /Back to National View/i).should("exist");
    cy.contains(".active-filter-chip", /Ridings/i).should("exist");
  });

  it("shows a boundary-set chip in province view", () => {
    cy.get('input[aria-label="Search region"]').type("Ontario");
    cy.contains(".search-dropdown li", "Ontario").click();

    // The active boundary set's shortLabel appears as a chip (e.g. "2013 Map")
    cy.contains(".active-filter-chip", /Map/i).should("exist");
  });

  it("searches ridings after selecting a province", () => {
    cy.get('input[aria-label="Search region"]').type("Ontario");
    cy.contains(".search-dropdown li", "Ontario").click();

    // Search placeholder should switch to riding search
    cy.get('input[aria-label="Search region"]')
      .should("have.attr", "placeholder")
      .and("match", /Ridings/i);
  });

  it("returns to the national view via the back button", () => {
    cy.get('input[aria-label="Search region"]').type("Ontario");
    cy.contains(".search-dropdown li", "Ontario").click();
    cy.contains(".map-back-btn", /Back to National View/i).click();

    // Back to national: Canada chip returns, back button gone
    cy.contains(".active-filter-chip", /Canada/i).should("exist");
    cy.get(".map-back-btn").should("not.exist");
  });

  it("does not crash when drilling in — panel or map always renders", () => {
    cy.get('input[aria-label="Search region"]').type("Ontario");
    cy.contains(".search-dropdown li", "Ontario").click();

    // The side panel is always present (no blank screen / crash)
    cy.get(".side-panel").should("exist");
    cy.get(".map-wrap").should("exist");
  });
});