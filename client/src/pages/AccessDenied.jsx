import { useNavigate } from "react-router-dom";

export default function AccessDenied() {
  const navigate = useNavigate();

  return (
    <div className="denied">
      <h1>Access Denied</h1>
      <p>Your account is not authorized.</p>
      <button onClick={() => navigate("/")}>Return Home</button>
      <button onClick={() => navigate("/login")}>Retry Login</button>
    </div>
  );
}