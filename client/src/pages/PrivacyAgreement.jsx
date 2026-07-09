import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api/config";

export default function PrivacyAgreement() {
  const [agree, setAgree] = useState(false);
  const navigate = useNavigate();

  async function handleAgree() {
    if (!agree) {
      alert("Please agree before continuing.");
      return;
    }

    const token = localStorage.getItem("token");

    const response = await fetch(`${API_BASE}/auth/agree-privacy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem("token", data.token);
      navigate("/dashboard");
    } else {
      alert(data.message);
    }
  }

  return (
    <div className="privacy-page">
      <div className="privacy-box">
        <h2>Privacy Agreement</h2>
        <p>
          Access to individual donation records is for approved research
          purposes only. All queries and exports will be logged.
        </p>
        <label>
          <input
            type="radio"
            name="privacy"
            checked={agree=== true}
            onChange={() => setAgree(true)}
          />
          {" "}I agree to the privacy policy.
        </label>
        <br />
        <label>
          <input
            type="radio"
            name="privacy"
            checked={agree === false}
            onChange={() => setAgree(false)}
          />
          {" "}I do not agree.
        </label>
        <button onClick={handleAgree}>Continue</button>
      </div>
    </div>
  );
}
