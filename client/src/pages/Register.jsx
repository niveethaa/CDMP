import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api/config";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [registered, setRegistered] = useState(false);
  const navigate = useNavigate();

  async function handleRegister(e) {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (response.ok) {
      setRegistered(true);
      if (data.emailPreview) {
        setPreviewUrl(data.emailPreview);
      }
    } else {
      alert(data.message);
    }
  }

  if (registered) {
    return (
      <div className="login-page">
        <div className="login-box">
          <h1>Check Your Email</h1>
          <p>A verification link has been sent to <strong>{email}</strong>.</p>
          <p>Click the link in the email to activate your account before logging in.</p>
          {previewUrl && (
            <p style={{ marginTop: "16px", fontSize: "13px", textAlign: "center" }}>
              <a href={previewUrl} target="_blank" rel="noreferrer">
                Preview verification email (dev only)
              </a>
            </p>
          )}
          <p style={{ marginTop: "16px", fontSize: "13px", textAlign: "center" }}>
            <button type="button" className="text-link" onClick={() => navigate("/login")}>
              Go to Login
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-icon">🔬</div>
        <h1>Research Sign Up</h1>
        <p>Authorized University Researchers Only</p>
        <form onSubmit={handleRegister}>
          <div>
            <label>University Email</label>
            <input
              type="email"
              placeholder="name@mail.utoronto.ca"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label>Confirm Password</label>
            <input
              type="password"
              placeholder="••••••••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <button type="submit">Create Account</button>
        </form>
        <p style={{ marginTop: "16px", fontSize: "13px" }}>
          Already have an account?{" "}
          <button type="button" className="text-link" onClick={() => navigate("/login")}>
            Log In
          </button>
        </p>
      </div>
    </div>
  );
}