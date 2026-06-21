const RegionStat = require("../models/RegionStat");

// Returns all province-level stats (for the map overview)
async function getAllProvinceStats() {
  return RegionStat.find({
    "region.level": "province",
    "filters.partyCode": "ALL",
    "filters.metricMode": "total",
  })
    .select("region totals partyStats donationsTrend privacy filters")
    .lean();
}

// Returns national-level stats
async function getNationalStats() {
  return RegionStat.findOne({
    "region.level": "national",
    "region.code": "CA",
    "filters.partyCode": "ALL",
    "filters.metricMode": "total",
  })
    .select("region totals partyStats donationsTrend privacy filters")
    .lean();
}

// Returns stats for one specific region by level + code (e.g. province + ON)
async function getRegionStats(level, code) {
  return RegionStat.findOne({
    "region.level": level,
    "region.code": code.toUpperCase(),
    "filters.partyCode": "ALL",
    "filters.metricMode": "total",
  })
    .select("region totals partyStats donationsTrend privacy filters")
    .lean();
}

module.exports = {
  getAllProvinceStats,
  getNationalStats,
  getRegionStats,
};