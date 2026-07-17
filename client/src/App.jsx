import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import PrivacyAgreement from "./pages/PrivacyAgreement";
import Dashboard from "./pages/Dashboard";
import AccessDenied from "./pages/AccessDenied";
import Account from "./pages/Account";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/privacy" element={<PrivacyAgreement />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/access-denied" element={<AccessDenied />} />
        <Route path="/account" element={<Account />} />
      </Routes>
    </BrowserRouter>
  );
}