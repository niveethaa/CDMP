const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ActivityLog = require("../models/ActivityLog");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

const PASSWORD_RESET_MESSAGE = "If that account exists, password reset instructions are available.";

function getPasswordMarker(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function isPasswordResetPreviewEnabled() {
  return String(process.env.PASSWORD_RESET_PREVIEW || "").toLowerCase() === "true";
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    // University of Toronto addresses only. This matches any subdomain of
    // utoronto.ca (e.g. utoronto.ca, mail.utoronto.ca, cs.utoronto.ca) but
    // rejects unrelated .ca / .edu domains.
    const normalizedEmail = email.trim().toLowerCase();
    if (
      !normalizedEmail.endsWith("@utoronto.ca") &&
      !normalizedEmail.endsWith(".utoronto.ca")
    ) {
      return res.status(403).json({ message: "Only University of Toronto email addresses are allowed." });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashed });

    res.status(201).json({ message: "Account created successfully.", userId: user._id });
  } catch (error) {
    console.error("POST /api/auth/register error:", error.message);
    res.status(500).json({ message: "Registration failed." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      await ActivityLog.create({ email, action: "login_failed" }).catch(() => {});
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      await ActivityLog.create({
        user: user._id,
        email: user.email,
        action: "login_failed",
      }).catch(() => {});
      return res.status(401).json({ message: "Invalid email or password." });
    }

    await ActivityLog.create({
      user: user._id,
      email: user.email,
      action: "login",
    });

    if (!user.agreedToPrivacyPolicy) {
      const tempToken = jwt.sign(
        { userId: user._id, email: user.email, role: user.role, requiresPrivacyAgreement: true },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );
      return res.json({ requiresPrivacyAgreement: true, token: tempToken });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ token, email: user.email, role: user.role });
  } catch (error) {
    console.error("POST /api/auth/login error:", error.message);
    res.status(500).json({ message: "Login failed." });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email });
    const response = { message: PASSWORD_RESET_MESSAGE };

    if (user && isPasswordResetPreviewEnabled()) {
      const resetToken = jwt.sign(
        {
          userId: user._id,
          purpose: "password-reset",
          passwordMarker: getPasswordMarker(user.password),
        },
        process.env.JWT_SECRET,
        { expiresIn: "15m" }
      );
      const clientUrl = String(process.env.CLIENT_URL || "http://localhost:8080").replace(/\/$/, "");
      response.resetUrl = `${clientUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
    }

    res.json(response);
  } catch (error) {
    console.error("POST /api/auth/forgot-password error:", error.message);
    res.status(500).json({ message: "Password reset could not be started." });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Reset token and new password are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters." });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ message: "The reset link is invalid or has expired." });
    }

    if (payload.purpose !== "password-reset") {
      return res.status(400).json({ message: "The reset link is invalid or has expired." });
    }

    const user = await User.findById(payload.userId);
    if (!user || payload.passwordMarker !== getPasswordMarker(user.password)) {
      return res.status(400).json({ message: "The reset link is invalid or has expired." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await ActivityLog.create({
      user: user._id,
      email: user.email,
      action: "password_reset",
    });

    res.json({ message: "Password reset successfully." });
  } catch (error) {
    console.error("POST /api/auth/reset-password error:", error.message);
    res.status(500).json({ message: "Password reset failed." });
  }
});

// POST /api/auth/agree-privacy
router.post("/agree-privacy", requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.userId, { agreedToPrivacyPolicy: true });

    await ActivityLog.create({
      user: req.user.userId,
      email: req.user.email,
      action: "privacy_agreement",
    });

    const token = jwt.sign(
      { userId: req.user.userId, email: req.user.email, role: req.user.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ token, email: req.user.email, role: req.user.role });
  } catch (error) {
    console.error("POST /api/auth/agree-privacy error:", error.message);
    res.status(500).json({ message: "Failed to record privacy agreement." });
  }
});
// GET /api/auth/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    res.json({ email: user.email, role: user.role, createdAt: user.createdAt });
  } catch (error) {
    console.error("GET /api/auth/me error:", error.message);
    res.status(500).json({ message: "Failed to fetch account info." });
  }
});

// PUT /api/auth/change-password
router.put("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters." });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await ActivityLog.create({
      user: user._id,
      email: user.email,
      action: "password_change",
    });

    res.json({ message: "Password updated successfully." });
  } catch (error) {
    console.error("PUT /api/auth/change-password error:", error.message);
    res.status(500).json({ message: "Failed to change password." });
  }
});
module.exports = router;
