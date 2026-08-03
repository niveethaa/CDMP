/// <reference types="cypress" />

describe("Ask CDMP panel (UC6)", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("shows example prompts before any question is asked", () => {
    cy.contains(/Ask CDMP/i).should("exist");
    cy.contains(/Try asking/i).should("exist");
  });

  it("displays an answer for a supported question (happy path)", () => {
    cy.intercept("POST", "**/api/ask", {
      statusCode: 200,
      body: {
        answer: "The Conservative Party raised the most.",
        data: { rows: [{ label: "CPC", value: 1000 }] },
        interpretedFilters: { partyCodes: ["CPC"], metric: "totalDonations" },
        coverage: { beginningYear: 1993, endingYear: 2024 },
      },
    }).as("ask");

    cy.get('input[aria-label="Ask a question about donation data"]').type(
      "Which party raised the most?"
    );
    cy.get('button[aria-label="Submit question"]').click();
    cy.wait("@ask");

    cy.contains(".ask-answer-text", /Conservative Party raised the most/i).should("exist");
  });

  it("shows the unsupported message for an out-of-scope question (E1)", () => {
    cy.intercept("POST", "**/api/ask", {
      statusCode: 422,
      body: { message: "Unsupported.", supported: false },
    }).as("askUnsupported");

    cy.get('input[aria-label="Ask a question about donation data"]').type(
      "What is the weather?"
    );
    cy.get('button[aria-label="Submit question"]').click();
    cy.wait("@askUnsupported");

    cy.contains(/outside the supported CDMP aggregate queries/i).should("exist");
  });

  it("shows an error message when the AI service is unavailable (E3)", () => {
    cy.intercept("POST", "**/api/ask", {
      statusCode: 503,
      body: { message: "The AI service is temporarily unavailable." },
    }).as("askDown");

    cy.get('input[aria-label="Ask a question about donation data"]').type(
      "Top parties in Ontario?"
    );
    cy.get('button[aria-label="Submit question"]').click();
    cy.wait("@askDown");

    cy.contains(/temporarily unavailable/i).should("exist");
  });

  it("shows a rate-limit message after too many requests (429)", () => {
    cy.intercept("POST", "**/api/ask", {
      statusCode: 429,
      body: { message: "Too many requests." },
    }).as("askLimited");

    cy.get('input[aria-label="Ask a question about donation data"]').type("A question");
    cy.get('button[aria-label="Submit question"]').click();
    cy.wait("@askLimited");

    cy.contains(/Too many requests/i).should("exist");
  });
});