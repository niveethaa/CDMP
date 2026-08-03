import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api/config";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");
    setResetUrl("");

    try {
      const response = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      setMessage(data.message || "Password reset could not be started.");
      if (response.ok && data.resetUrl) {
        setResetUrl(data.resetUrl);
      }
    } catch {
      setMessage("Password reset could not be started.");
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <h1>Forgot Password</h1>
        <p>Enter your university email to reset your password.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="University Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit">Continue</button>
        </form>
        {message && <p style={{ marginTop: "16px", fontSize: "13px", textAlign: "center" }}>{message}</p>}
        {resetUrl && (
          <p style={{ marginTop: "8px", fontSize: "13px", textAlign: "center" }}>
            <a href={resetUrl}>Open demo reset form</a>
          </p>
        )}
        <p style={{ marginTop: "16px", fontSize: "13px", textAlign: "center" }}>
          <button type="button" className="text-link" onClick={() => navigate("/login")}>
            Back to Login
          </button>
        </p>
      </div>
    </div>
  );
}
