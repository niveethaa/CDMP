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
  const [statusType, setStatusType] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    async function loadAccount() {
      try {
        const data = await fetchMe();
        setEmail(data.email);
        setRole(data.role);
        setCreatedAt(new Date(data.createdAt).toLocaleDateString("en-CA", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }));
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
    setStatusType("");

    if (newPassword !== confirmPassword) {
      setStatusMessage("New passwords do not match.");
      setStatusType("error");
      return;
    }
    if (newPassword.length < 8) {
      setStatusMessage("New password must be at least 8 characters.");
      setStatusType("error");
      return;
    }

    try {
      const data = await changePassword(currentPassword, newPassword);
      setStatusMessage(data.message);
      setStatusType("success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setStatusMessage(err.message);
      setStatusType("error");
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
    <div className="login-page account-page">
      <main className="account-card">
        <header className="account-header">
          <div className="account-avatar" aria-hidden="true">
            {email.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="account-eyebrow">Researcher profile</p>
            <h1>My Account</h1>
            <p className="account-subtitle">Manage your account details and password.</p>
          </div>
        </header>

        <dl className="account-details">
          <div className="account-detail account-detail--email">
            <dt>Email address</dt>
            <dd>{email}</dd>
          </div>
          <div className="account-detail">
            <dt>Account role</dt>
            <dd>{role.charAt(0).toUpperCase() + role.slice(1)}</dd>
          </div>
          <div className="account-detail">
            <dt>Member since</dt>
            <dd>{createdAt}</dd>
          </div>
        </dl>

        <section className="account-password-section">
          <div className="account-section-header">
            <div>
              <p className="account-eyebrow">Security</p>
              <h2>Change Password</h2>
            </div>
            <span>Minimum 8 characters</span>
          </div>

          <form className="account-password-form" onSubmit={handleChangePassword}>
            <div className="account-field account-field--full">
              <label htmlFor="current-password">Current password</label>
              <input
                id="current-password"
                type="password"
                placeholder="Enter your current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="account-field">
              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                type="password"
                placeholder="Enter a new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div className="account-field">
              <label htmlFor="confirm-password">Confirm new password</label>
              <input
                id="confirm-password"
                type="password"
                placeholder="Repeat your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <button type="submit">Update Password</button>
          </form>

          {statusMessage && (
            <p className={`account-status account-status--${statusType}`} role="status">
              {statusMessage}
            </p>
          )}
        </section>

        <footer className="account-footer">
          <button
            type="button"
            className="account-back-button"
            onClick={() => navigate("/dashboard")}
          >
            <span aria-hidden="true">←</span>
            Back to Dashboard
          </button>
        </footer>
      </main>
    </div>
  );
}
