/// <reference types="cypress" />

describe("Research login (UC3)", () => {
  it("shows the login form", () => {
    cy.visit("/login");
    cy.contains(/Research Login/i).should("exist");
    cy.get('input[type="email"]').should("exist");
    cy.get('input[type="password"]').should("exist");
    cy.contains("button", /Log In/i).should("exist");
  });

  it("rejects invalid credentials", () => {
    cy.visit("/login");
    const alertStub = cy.stub().as("alert");
    cy.on("window:alert", alertStub);

    cy.get('input[type="email"]').type("fake@utoronto.ca");
    cy.get('input[type="password"]').type("wrongpassword");
    cy.contains("button", /Log In/i).click();

    // Cypress retries this until the async fetch resolves and alert fires
    cy.get("@alert").should("have.been.called");
  });

  it("links to the register page", () => {
    cy.visit("/login");
    cy.contains(/Sign Up/i).click();
    cy.url().should("include", "/register");
  });
});