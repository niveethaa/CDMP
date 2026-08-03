import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE } from "../api/config";

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      const response = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await response.json();
      setMessage(data.message || "Password reset failed.");
      if (response.ok) {
        setTimeout(() => navigate("/login"), 2000);
      }
    } catch {
      setMessage("Password reset failed.");
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <h1>Reset Password</h1>
        <p>Enter your new password below.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="New Password (min 8 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />
          <button type="submit" disabled={!token}>Reset Password</button>
        </form>
        {!token && <p style={{ marginTop: "16px", fontSize: "13px", textAlign: "center" }}>This reset link is invalid.</p>}
        {message && <p style={{ marginTop: "16px", fontSize: "13px", textAlign: "center" }}>{message}</p>}
      </div>
    </div>
  );
}
