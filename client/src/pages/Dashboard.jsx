import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/");
  }

  return (
    <div className="dashboard">
      <div className="sidebar">
        <h3>Filters</h3>
        <label>Province</label>
        <select>
          <option>All Provinces</option>
          <option>Ontario</option>
          <option>British Columbia</option>
          <option>Quebec</option>
          <option>Alberta</option>
        </select>
        <label>Party</label>
        <select>
          <option>All Parties</option>
          <option>Liberal</option>
          <option>Conservative</option>
          <option>NDP</option>
          <option>Bloc Québécois</option>
          <option>Green</option>
        </select>
        <button>Apply Filters</button>
        <button>Export CSV</button>
        <button onClick={() => navigate("/account")}>My Account</button>
        <button onClick={handleLogout}>Logout</button>
      </div>
      <div className="table-container">
        <input placeholder="Search Donors..." />
        <table>
          <thead>
            <tr>
              <th>Donor</th>
              <th>Amount</th>
              <th>Party</th>
              <th>Date</th>
              <th>Postal Code</th>
              <th>Riding</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>John Smith</td>
              <td>$250</td>
              <td>Liberal</td>
              <td>2021-06-15</td>
              <td>M5V2T6</td>
              <td>Toronto Centre</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="activity">
        <h3>Research Activity</h3>
        <p>All queries and exports are logged.</p>
        <hr />
        <h3>Access Status</h3>
        <p>Research Tier Active</p>
      </div>
    </div>
  );
}