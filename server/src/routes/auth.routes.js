const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const ActivityLog = require("../models/ActivityLog");
const { requireAuth } = require("../middleware/auth.middleware");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../services/email.service");

const router = express.Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

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
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const user = await User.create({
      email,
      password: hashed,
      verificationToken,
      isVerified: false,
    });

    const previewUrl = await sendVerificationEmail(normalizedEmail, verificationToken);

    res.status(201).json({
      message: "Account created. Please check your email to verify your account.",
      userId: user._id,
      ...(previewUrl && { emailPreview: previewUrl }),
    });
  } catch (error) {
    console.error("POST /api/auth/register error:", error.message);
    res.status(500).json({ message: "Registration failed." });
  }
});

// GET /api/auth/verify-email
router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ message: "Verification token is required." });
    }

    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired verification token." });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.redirect("http://localhost:8080/login?verified=true");
  } catch (error) {
    console.error("GET /api/auth/verify-email error:", error.message);
    res.status(500).json({ message: "Email verification failed." });
  }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(200).json({ message: "If that email exists, a reset link has been sent." });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const previewUrl = await sendPasswordResetEmail(user.email, resetToken);

    res.json({
      message: "If that email exists, a reset link has been sent.",
      ...(previewUrl && { emailPreview: previewUrl }),
    });
  } catch (error) {
    console.error("POST /api/auth/forgot-password error:", error.message);
    res.status(500).json({ message: "Failed to send reset email." });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password are required." });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    await ActivityLog.create({
      user: user._id,
      email: user.email,
      action: "password_reset",
    }).catch(() => {});

    res.json({ message: "Password reset successfully." });
  } catch (error) {
    console.error("POST /api/auth/reset-password error:", error.message);
    res.status(500).json({ message: "Failed to reset password." });
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

    if (!user.isVerified) {
      return res.status(403).json({ message: "Please verify your email before logging in." });
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