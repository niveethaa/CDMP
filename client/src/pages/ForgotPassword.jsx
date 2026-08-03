import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api/config";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    const response = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    setMessage(data.message);
    if (data.emailPreview) {
      setPreviewUrl(data.emailPreview);
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <h1>Forgot Password</h1>
        <p>Enter your university email to receive a reset link.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="University Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit">Send Reset Link</button>
        </form>
        {message && <p style={{ marginTop: "16px", fontSize: "13px", textAlign: "center" }}>{message}</p>}
        {previewUrl && (
          <p style={{ marginTop: "8px", fontSize: "13px", textAlign: "center" }}>
            <a href={previewUrl} target="_blank" rel="noreferrer">Preview email (dev only)</a>
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