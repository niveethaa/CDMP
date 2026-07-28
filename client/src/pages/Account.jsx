import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchMe, changePassword } from "../api/auth";

export default function Account() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    async function loadAccount() {
      try {
        const data = await fetchMe();
        setEmail(data.email);
        setRole(data.role);
        setCreatedAt(new Date(data.createdAt).toLocaleDateString());
      } catch {
        navigate("/login");
      } finally {
        setLoading(false);
      }
    }
    loadAccount();
  }, [navigate]);

  async function handleChangePassword(e) {
    e.preventDefault();
    setStatusMessage("");

    if (newPassword !== confirmPassword) {
      setStatusMessage("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setStatusMessage("New password must be at least 8 characters.");
      return;
    }

    try {
      const data = await changePassword(currentPassword, newPassword);
      setStatusMessage(data.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setStatusMessage(err.message);
    }
  }

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-box">
          <p>Loading account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <h1>My Account</h1>
        <p>Researcher account information</p>

        <div style={{ margin: "20px 0", textAlign: "left" }}>
          <p><strong>Email:</strong> {email}</p>
          <p><strong>Role:</strong> {role}</p>
          <p><strong>Member since:</strong> {createdAt}</p>
        </div>

        <h2 style={{ fontSize: "18px", marginTop: "24px" }}>Change Password</h2>
        <form onSubmit={handleChangePassword}>
          <input
            type="password"
            placeholder="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <button type="submit">Update Password</button>
        </form>

        {statusMessage && (
          <p style={{ marginTop: "12px", fontSize: "14px", textAlign: "center" }}>
            {statusMessage}
          </p>
        )}

        <p style={{ marginTop: "16px", fontSize: "13px", textAlign: "center" }}>
          <span
            onClick={() => navigate("/dashboard")}
            style={{ color: "#818cf8", cursor: "pointer" }}
          >
            Back to Dashboard
          </span>
        </p>
      </div>
    </div>
  );
}