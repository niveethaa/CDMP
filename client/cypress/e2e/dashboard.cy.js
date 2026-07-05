/// <reference types="cypress" />

describe("CDMP dashboard (tasks 10 & 11)", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("loads the national overview on first load", () => {
    cy.contains(/Canada/i).should("be.visible");
    cy.contains(/Total Donations/i).should("be.visible");
  });

  it("renders the party breakdown and yearly trend", () => {
    cy.contains(/Party Breakdown/i).should("exist");
    cy.contains(/Yearly Trend/i).should("exist");
  });

  it("shows region results when searching", () => {
    cy.get('input[aria-label="Search region"]').type("alb");
    cy.contains("Alberta").should("be.visible");
  });

  it("shows a no-results message for an unmatched search", () => {
    cy.get('input[aria-label="Search region"]').type("zzzzz");
    cy.contains(/no regions found/i).should("be.visible");
  });

  it("loads a province summary when a search result is selected", () => {
    cy.get('input[aria-label="Search region"]').type("alb");
    cy.contains("Alberta").click();
    cy.get(".region-panel").contains("Alberta").should("be.visible");
  });

  it("opens the filters popover", () => {
    cy.contains("button", "Filters").click();
    cy.contains(/Filter donations/i).should("be.visible");
  });

  it("returns to the national view after selecting a province", () => {
    cy.get('input[aria-label="Search region"]').type("alb");
    cy.contains("Alberta").click();
    cy.contains("button", /All of Canada|← Canada/).click();
    cy.contains(/National Overview/i).should("be.visible");
  });
});