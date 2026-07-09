import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error(
      `[ErrorBoundary${this.props.label ? ` · ${this.props.label}` : ""}]`,
      error,
      info?.componentStack,
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (typeof this.props.fallback === "function") {
      return this.props.fallback({
        error: this.state.error,
        reset: this.handleReset,
      });
    }

    const label = this.props.label || "this section";

    return (
      <div
        role="alert"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          minHeight: this.props.compact ? "180px" : "60vh",
          padding: "2rem",
          textAlign: "center",
          background: "#131625",
          color: "#f1f5f9",
          borderRadius: "12px",
        }}
      >
        <div style={{ fontSize: "1.6rem" }}>⚠️</div>
        <p style={{ margin: 0, fontWeight: 600 }}>
          Something went wrong while loading {label}.
        </p>
        <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.9rem", maxWidth: "34ch" }}>
          The rest of the page is still available. You can retry this section or
          refresh the page.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              background: "#4361ee",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "0.5rem 1rem",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: "#1e2235",
              color: "#f1f5f9",
              border: "1px solid #2e3550",
              borderRadius: "8px",
              padding: "0.5rem 1rem",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            Refresh page
          </button>
        </div>
      </div>
    );
  }
}
