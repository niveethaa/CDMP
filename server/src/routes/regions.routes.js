const express = require("express");
const {
  getAllProvinceStats,
  getNationalStats,
  getRegionStats,
  getRidingStatsForProvince,
} = require("../services/regionStats.service");

const router = express.Router();

// GET /api/regions/national?partyCode=ALL&beginningYear=1993&endingYear=2024&metricMode=total
router.get("/national", async (req, res) => {
  try {
    const stats = await getNationalStats(req.query);
    if (!stats) {
      return res.status(404).json({ message: "National stats not found." });
    }
    res.json(stats);
  } catch (error) {
    console.error("GET /api/regions/national error:", error.message);
    res.status(500).json({ message: "Failed to load national stats." });
  }
});

// GET /api/regions/provinces?partyCode=ALL&beginningYear=1993&endingYear=2024&metricMode=total
router.get("/provinces", async (req, res) => {
  try {
    const stats = await getAllProvinceStats(req.query);
    res.json(stats);
  } catch (error) {
    console.error("GET /api/regions/provinces error:", error.message);
    res.status(500).json({ message: "Failed to load province stats." });
  }
});

// GET /api/regions/ridings/:provinceCode?boundarySet=federal_ridings_2013&partyCode=ALL&beginningYear=2015&endingYear=2024&metricMode=total
router.get("/ridings/:provinceCode", async (req, res) => {
  const { provinceCode } = req.params;

  try {
    const stats = await getRidingStatsForProvince(provinceCode, req.query);
    res.json(stats);
  } catch (error) {
    console.error(
      `GET /api/regions/ridings/${provinceCode} error:`,
      error.message,
    );
    res.status(500).json({ message: "Failed to load riding stats." });
  }
});

// GET /api/regions/:level/:code?partyCode=ALL&beginningYear=1993&endingYear=2024&metricMode=total&boundarySet=federal_ridings_2013
router.get("/:level/:code", async (req, res) => {
  const { level, code } = req.params;
  const validLevels = ["national", "province", "riding"];

  if (!validLevels.includes(level)) {
    return res.status(400).json({ message: "Invalid region level." });
  }

  try {
    const stats = await getRegionStats(level, code, req.query);
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
