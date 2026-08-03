import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api/config";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (response.ok) {
      localStorage.setItem("token", data.token);
      if (data.requiresPrivacyAgreement) {
        navigate("/privacy");
      } else {
        navigate("/dashboard");
      }
    } else {
      alert(data.message);
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <h1>Research Login</h1>
        <p>Authorized University Researchers Only</p>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="University Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit">Log In</button>
        </form>
        <p style={{ marginTop: "16px", fontSize: "13px", textAlign: "center" }}>
          <button
            type="button"
            className="text-link"
            onClick={() => navigate("/forgot-password")}
          >
            Forgot your password?
          </button>
        </p>
        <p style={{ marginTop: "8px", fontSize: "13px", textAlign: "center" }}>
          Don't have an account?{" "}
          <button
            type="button"
            className="text-link"
            onClick={() => navigate("/register")}
          >
            Sign Up
          </button>
        </p>
      </div>
    </div>
  );
}