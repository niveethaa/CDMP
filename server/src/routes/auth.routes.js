const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ActivityLog = require("../models/ActivityLog");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    if (!email.endsWith(".ca") && !email.endsWith(".edu")) {
      return res.status(403).json({ message: "Only University of Toronto email addresses are allowed." });
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
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
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

// POST /api/auth/agree-privacy
router.post("/agree-privacy", requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.userId, { agreedToPrivacyPolicy: true });

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

module.exports = router;