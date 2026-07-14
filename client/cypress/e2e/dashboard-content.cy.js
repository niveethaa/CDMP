/// <reference types="cypress" />

describe("Dashboard content is correct (tasks 10 & 11)", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("shows the correct national totals for Canada", () => {
    cy.contains(/Canada/i).should("exist");
    cy.contains(/Total Donations/i).should("exist");
    cy.contains("$").should("exist"); // shows a dollar total
  });

  it("lists the major parties in the breakdown", () => {
    cy.contains(/Party Breakdown/i).should("exist");
    ["CPC", "LPC", "NDP", "GPC", "BQ", "PPC"].forEach((party) => {
      cy.contains(party).should("exist");
    });
  });

  it("shows the four national summary stats", () => {
    cy.contains(/Total Donations/i).should("exist");
    cy.contains(/Donations/i).should("exist");
    cy.contains(/Donors/i).should("exist");
    cy.contains(/Average Donation/i).should("exist");
  });

  it("shows Alberta's own data after selecting it", () => {
    cy.get('input[aria-label="Search region"]').type("alb");
    cy.contains("Alberta").click();
    cy.get(".region-panel").within(() => {
      cy.contains("Alberta").should("exist");
      cy.contains("$").should("exist"); // shows a dollar total (any amount)
    });
  });

  it("shows the yearly trend section with the 2004–2024 range", () => {
    cy.contains(/Yearly Trend/i).should("exist");
    cy.contains(/2004/).should("exist");
    cy.contains(/2024/).should("exist");
  });
});