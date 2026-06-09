/// <reference types="cypress" />

describe("Home page", () => {
  it("loads the React app", () => {
    cy.visit("/");
    cy.contains("App is running").should("be.visible");
  });
});
