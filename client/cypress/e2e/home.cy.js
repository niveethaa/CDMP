/// <reference types="cypress" />

describe("Home page", () => {
  it("loads the CDMP React app", () => {
    cy.visit("/");
    cy.get("body").should(($body) => {
      const text = $body.text();
      expect(text).to.match(/CDMP|donation map is currently unavailable/i);
    });
  });
});
