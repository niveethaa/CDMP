/// <reference types="cypress" />

describe("Dashboard exception warnings (UC3)", () => {
  const EMAIL = Cypress.env("RESEARCHER_EMAIL");
  const PASSWORD = Cypress.env("RESEARCHER_PASSWORD");

  function login() {
    cy.visit("/login");
    cy.get('input[type="email"]').type(EMAIL);
    cy.get('input[type="password"]').type(PASSWORD);
    cy.contains("button", /Log In/i).click();
    cy.url({ timeout: 8000 }).should("match", /\/privacy|\/dashboard/);
    cy.url().then((url) => {
      if (url.includes("/privacy")) {
        cy.contains("label", /I agree/i).find('input[type="radio"]').check();
        cy.contains("button", /Continue/i).click();
      }
    });
    cy.url({ timeout: 8000 }).should("include", "/dashboard");
  }

  it("shows a warning when CSV export fails", () => {
    login();

    // Force the export request to fail
    cy.intercept("GET", "**/research/donations/export*", {
      statusCode: 500,
      body: {},
    }).as("failedExport");

    cy.contains("button", /Export CSV/i).click();
    cy.wait("@failedExport");

    // The export-error warning should appear with non-technical text
    cy.contains(/Export failed/i).should("exist");
  });

  it("does not crash and shows the records table on load", () => {
    login();
    // Table headers render (no blank screen)
    cy.contains("th", /Donor/i).should("exist");
    cy.contains("th", /Amount/i).should("exist");
  });

  it("shows an empty-state message when filters match no records", () => {
    // Intercept BEFORE the dashboard loads, so the on-mount fetch is caught
    cy.intercept("GET", "**/research/donations?*", {
      statusCode: 200,
      body: { donations: [], total: 0, page: 1, limit: 20, totalPages: 1 },
    }).as("emptyDonations");

    login();

    // With zero records mocked, the empty-state message renders
    cy.contains(/No records found/i).should("exist");
  });
});