const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided." });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

function requireResearcher(req, res, next) {
  if (req.user.role !== "researcher") {
    return res.status(403).json({ message: "Forbidden." });
  }
  // A token issued before the user accepted the privacy agreement is only
  // valid for completing that agreement. It must never reach individual
  // research records, even though it carries the "researcher" role.
  if (req.user.requiresPrivacyAgreement) {
    return res.status(403).json({
      message: "You must accept the privacy agreement before accessing research data.",
    });
  }
  next();
}

module.exports = { requireAuth, requireResearcher };