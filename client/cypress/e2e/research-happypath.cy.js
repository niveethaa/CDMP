/// <reference types="cypress" />

describe("Researcher happy-path (UC3)", () => {
  const EMAIL = Cypress.env("RESEARCHER_EMAIL");
  const PASSWORD = Cypress.env("RESEARCHER_PASSWORD");

  it("logs in, accepts privacy if prompted, and reaches the records dashboard", () => {
    cy.visit("/login");
    cy.get('input[type="email"]').type(EMAIL);
    cy.get('input[type="password"]').type(PASSWORD);
    cy.contains("button", /Log In/i).click();

    // First-ever login lands on /privacy; later logins skip to /dashboard.
    cy.url({ timeout: 8000 }).should("match", /\/privacy|\/dashboard/);

    cy.url().then((url) => {
      if (url.includes("/privacy")) {
        // Select "I agree" radio, then Continue
        cy.contains("label", /I agree/i).find('input[type="radio"]').check();
        cy.contains("button", /Continue/i).click();
      }
    });

    // Now on the dashboard
    cy.url({ timeout: 8000 }).should("include", "/dashboard");
    cy.contains(/Research Tier Active/i).should("exist");
  });

  it("shows the records table and filter controls", () => {
    loginToDashboard(EMAIL, PASSWORD);

    // Table headers exist (the individual-records table)
    cy.contains("th", /Donor/i).should("exist");
    cy.contains("th", /Amount/i).should("exist");
    cy.contains("th", /Postal Code/i).should("exist");

    // Filter + export controls exist
    cy.contains("button", /Apply Filters/i).should("exist");
    cy.contains("button", /Export CSV/i).should("exist");

    // Pagination summary exists
    cy.contains(/Page \d+ of/i).should("exist");
  });

 it("can filter records by province", () => {
    loginToDashboard(EMAIL, PASSWORD);

    // Sidebar selects in order: Donor Type, Province, Party, Year.
    // Province is the 2nd select (index 1).
    cy.get(".sidebar select").eq(1).select("ON");
    cy.contains("button", /Apply Filters/i).click();

    // Table still renders after applying (records or the empty-state row)
    cy.get("table").should("exist");
  });
});

// Helper: log in and get to the dashboard (agreeing to privacy if shown)
function loginToDashboard(email, password) {
  cy.visit("/login");
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').type(password);
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