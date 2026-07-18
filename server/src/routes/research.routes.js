const express = require("express");
const Donation = require("../models/Donation");
const ActivityLog = require("../models/ActivityLog");
const { requireAuth, requireResearcher } = require("../middleware/auth.middleware");

const router = express.Router();

function buildDonorName(donor) {
  const parts = [
    donor.donorFirstName || "",
    donor.donorMiddleName || "",
    donor.donorLastName || "",
  ];
  return parts.filter(Boolean).join(" ");
}

function buildCsvRow(donation) {
  const donor = donation.donor || {};
  const party = donation.party || {};
  const contribution = donation.contribution || {};
  const geography = donation.geography || {};

  const donorName = buildDonorName(donor);
  const partyCode = party.code || "";
  const amount = contribution.amountTotal || 0;
  const date = contribution.dateReceived
    ? new Date(contribution.dateReceived).toISOString().slice(0, 10)
    : "";
  const postalCode = donor.postalCode || "";
  const riding = geography.ridingName || "";
  const province = geography.provinceCode || "";

  return `${donorName},${partyCode},${amount},${date},${postalCode},${riding},${province}`;
}

function buildCsv(donations) {
  const header = "Donor,Party,Amount,Date,Postal Code,Riding,Province";
  const rows = donations.map(buildCsvRow);
  return [header, ...rows].join("\n");
}

// GET /api/research/donations — individual donation records
router.get("/donations", requireAuth, requireResearcher, async (req, res) => {
  const { province, party, year, search, riding, donorType, page = 1, limit = 20 } = req.query;

  try {
    const query = {};

    if (province && province !== "ALL") {
      query["geography.provinceCode"] = province.toUpperCase();
    }

    if (party && party !== "ALL") {
      query["party.code"] = party.toUpperCase();
    }

    if (year && year !== "ALL") {
      query["source.year"] = Number(year);
    }

    if (search && search.trim()) {
      query["donor.donorDisplayName"] = { $regex: search.trim(), $options: "i" };
    }

    if (riding && riding.trim()) {
      query["geography.ridingName"] = { $regex: riding.trim(), $options: "i" };
    }

    if (donorType && donorType !== "ALL") {
      if (donorType === "individuals") {
        query["donor.donorType"] = {
          $in: ["Individuals", "Individuals -- after December 31,2006"],
        };
      } else if (donorType === "organizations") {
        query["donor.donorType"] = {
          $in: ["Corporations", "Corporations -- prior to 2007", "Associations", "Trade unions"],
        };
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const donations = await Donation.find(query)
      .select(
        "donor.donorFirstName donor.donorMiddleName donor.donorLastName donor.donorDisplayName donor.donorType donor.postalCode party.code contribution.amountTotal contribution.dateReceived geography.ridingName geography.provinceCode"
      )
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Donation.countDocuments(query);

    await ActivityLog.create({
      user: req.user.userId,
      email: req.user.email,
      action: "query",
      filters: { province, party, year, search, riding, donorType, page },
    });

    res.json({
      donations,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    console.error("GET /api/research/donations error:", error.message);
    res.status(500).json({ message: "Failed to fetch donations." });
  }
});

// GET /api/research/donations/export — export filtered records as CSV
router.get("/donations/export", requireAuth, requireResearcher, async (req, res) => {
  const { province, party, year, search, riding, donorType } = req.query;

  try {
    const query = {};

    if (province && province !== "ALL") {
      query["geography.provinceCode"] = province.toUpperCase();
    }

    if (party && party !== "ALL") {
      query["party.code"] = party.toUpperCase();
    }

    if (year && year !== "ALL") {
      query["source.year"] = Number(year);
    }

    if (search && search.trim()) {
      query["donor.donorDisplayName"] = { $regex: search.trim(), $options: "i" };
    }

    if (riding && riding.trim()) {
      query["geography.ridingName"] = { $regex: riding.trim(), $options: "i" };
    }

    if (donorType && donorType !== "ALL") {
      if (donorType === "individuals") {
        query["donor.donorType"] = {
          $in: ["Individuals", "Individuals -- after December 31,2006"],
        };
      } else if (donorType === "organizations") {
        query["donor.donorType"] = {
          $in: ["Corporations", "Corporations -- prior to 2007", "Associations", "Trade unions"],
        };
      }
    }

    const donations = await Donation.find(query)
      .select(
        "donor.donorFirstName donor.donorMiddleName donor.donorLastName donor.donorDisplayName donor.donorType donor.postalCode party.code contribution.amountTotal contribution.dateReceived geography.ridingName geography.provinceCode"
      )
      .limit(10000)
      .lean();

    await ActivityLog.create({
      user: req.user.userId,
      email: req.user.email,
      action: "export",
      filters: { province, party, year, search, riding, donorType },
    });

    const csv = buildCsv(donations);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=donations.csv");
    res.send(csv);
  } catch (error) {
    console.error("GET /api/research/donations/export error:", error.message);
    res.status(500).json({ message: "Failed to export donations." });
  }
});

// GET /api/research/analytics — aggregated donation analytics for charts
router.get("/analytics", requireAuth, requireResearcher, async (req, res) => {
  const { province, party, year, search, riding, donorType } = req.query;

  try {
    const query = {};

    if (province && province !== "ALL") {
      query["geography.provinceCode"] = province.toUpperCase();
    }

    if (party && party !== "ALL") {
      query["party.code"] = party.toUpperCase();
    }

    if (year && year !== "ALL") {
      query["source.year"] = Number(year);
    }

    if (search && search.trim()) {
      query["donor.donorDisplayName"] = { $regex: search.trim(), $options: "i" };
    }

    if (riding && riding.trim()) {
      query["geography.ridingName"] = { $regex: riding.trim(), $options: "i" };
    }

    if (donorType && donorType !== "ALL") {
      if (donorType === "individuals") {
        query["donor.donorType"] = {
          $in: ["Individuals", "Individuals -- after December 31,2006"],
        };
      } else if (donorType === "organizations") {
        query["donor.donorType"] = {
          $in: ["Corporations", "Corporations -- prior to 2007", "Associations", "Trade unions"],
        };
      }
    }

    const [topRidings, amountDistribution] = await Promise.all([
      Donation.aggregate([
        { $match: query },
        {
          $match: {
            "geography.ridingName": { $exists: true, $ne: "" },
          },
        },
        {
          $group: {
            _id: "$geography.ridingName",
            donationCount: { $sum: 1 },
            totalDonations: { $sum: "$contribution.amountTotal" },
          },
        },
        { $sort: { donationCount: -1 } },
        { $limit: 5 },
      ]).allowDiskUse(true),

      Donation.aggregate([
        { $match: query },
        {
          $bucket: {
            groupBy: "$contribution.amountTotal",
            boundaries: [0, 50, 100, 250, 500, 1000, 5000, 10000],
            default: "10000+",
            output: {
              count: { $sum: 1 },
              total: { $sum: "$contribution.amountTotal" },
            },
          },
        },
      ]).allowDiskUse(true),
    ]);

    await ActivityLog.create({
      user: req.user.userId,
      email: req.user.email,
      action: "query",
      filters: { province, party, year, search, riding, donorType },
    });

    res.json({ topRidings, amountDistribution });
  } catch (error) {
    console.error("GET /api/research/analytics error:", error.message);
    res.status(500).json({ message: "Failed to fetch analytics." });
  }
});

module.exports = router;