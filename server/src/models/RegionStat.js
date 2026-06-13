const mongoose = require("mongoose");

const PartyStatsSchema = new mongoose.Schema(
  {
    partyCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    partyName: {
      type: String,
      trim: true,
    },
    totalDonations: {
      type: Number,
      default: 0,
    },
    donationCount: {
      type: Number,
      default: 0,
    },
    donorCount: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
);

const DonationsTrendSchema = new mongoose.Schema(
  {
    year: {
      type: Number,
      required: true,
    },
    totalDonations: {
      type: Number,
      default: 0,
    },
    donationCount: {
      type: Number,
      default: 0,
    },
    donorCount: {
      type: Number,
      default: 0,
    },
    perCapitaAmount: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
);

const RegionStatsSchema = new mongoose.Schema(
  {
    region: {
      level: {
        type: String,
        enum: ["national", "province", "riding"],
        required: true,
        index: true,
      },
      code: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        index: true,
      },
      name: {
        type: String,
        required: true,
        trim: true,
      },
      provinceCode: {
        type: String,
        trim: true,
        uppercase: true,
      },
      boundarySet: {
        type: String,
        trim: true,
      },
    },

    filters: {
      beginningYear: {
        type: Number,
        required: true,
        index: true,
      },
      endingYear: {
        type: Number,
        required: true,
        index: true,
      },
      partyCode: {
        type: String,
        trim: true,
        uppercase: true,
        index: true,
        default: "ALL",
      },
      metricMode: {
        type: String,
        enum: ["total", "per_capita"],
        default: "total",
        index: true,
      },
    },

    totals: {
      totalDonations: {
        type: Number,
        default: 0,
      },
      donationCount: {
        type: Number,
        default: 0,
      },
      donorCount: {
        type: Number,
        default: 0,
      },
      perCapitaAmount: {
        type: Number,
        default: 0,
      },
      population: {
        type: Number,
        default: 0,
      },
      averageDonation: {
        type: Number,
        default: 0,
      },
    },

    partyStats: {
      type: [PartyStatsSchema],
      default: [],
    },

    donationsTrend: {
      type: [DonationsTrendSchema],
      default: [],
    },

    privacy: {
      isSuppressed: {
        type: Boolean,
        default: false,
      },
      suppressionThreshold: {
        type: Number,
        default: 5,
      },
      suppressionReason: {
        type: String,
        trim: true,
      },
      computedAt: {
        type: Date,
        default: Date.now,
      },
    },
  },
  {
    timestamps: true,
    collection: "region_stats",
  },
);

RegionStatsSchema.index(
  {
    "region.level": 1,
    "region.code": 1,
    "region.boundarySet": 1,
    "filters.beginningYear": 1,
    "filters.endingYear": 1,
    "filters.partyCode": 1,
    "filters.metricMode": 1,
  },
  { unique: true },
);

RegionStatsSchema.index({ "totals.totalDonations": -1 });
RegionStatsSchema.index({ "totals.perCapitaAmount": -1 });

module.exports = mongoose.model("RegionStat", RegionStatsSchema);
