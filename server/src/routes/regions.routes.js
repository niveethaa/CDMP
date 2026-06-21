const express = require("express");
const {
  getAllProvinceStats,
  getNationalStats,
  getRegionStats,
} = require("../services/regionStats.service");

const router = express.Router();

// GET /api/regions/national  — national summary
router.get("/national", async (req, res) => {
  try {
    const stats = await getNationalStats();
    if (!stats) {
      return res.status(404).json({ message: "National stats not found." });
    }
    res.json(stats);
  } catch (error) {
    console.error("GET /api/regions/national error:", error.message);
    res.status(500).json({ message: "Failed to load national stats." });
  }
});

// GET /api/regions/provinces  — all provinces (for the map)
router.get("/provinces", async (req, res) => {
  try {
    const stats = await getAllProvinceStats();
    res.json(stats);
  } catch (error) {
    console.error("GET /api/regions/provinces error:", error.message);
    res.status(500).json({ message: "Failed to load province stats." });
  }
});

// GET /api/regions/:level/:code  — e.g. /api/regions/province/ON
router.get("/:level/:code", async (req, res) => {
  const { level, code } = req.params;
  const validLevels = ["national", "province", "riding"];

  if (!validLevels.includes(level)) {
    return res.status(400).json({ message: "Invalid region level." });
  }

  try {
    const stats = await getRegionStats(level, code);
    if (!stats) {
      return res
        .status(404)
        .json({ message: `No stats found for ${level} ${code}.` });
    }
    res.json(stats);
  } catch (error) {
    console.error(`GET /api/regions/${level}/${code} error:`, error.message);
    res.status(500).json({ message: "Failed to load region stats." });
  }
});

module.exports = router;