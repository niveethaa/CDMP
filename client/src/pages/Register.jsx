import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api/config";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
      alert("Account created! Please log in.");
      navigate("/login");
    } else {
      alert(data.message);
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-icon">👤</div>
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
          <span
            onClick={() => navigate("/login")}
            style={{ color: "#818cf8", cursor: "pointer" }}
          >
            Log In
          </span>
        </p>
      </div>
    </div>
  );
}
