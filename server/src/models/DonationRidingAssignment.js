const mongoose = require("mongoose");

const DonationRidingAssignmentSchema = new mongoose.Schema(
  {
    donationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Donation",
      required: true,
      index: true,
    },
    donationYear: {
      type: Number,
      required: true,
      index: true,
    },
    boundarySet: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    ridingCode: {
      type: String,
      trim: true,
      index: true,
    },
    ridingName: {
      type: String,
      trim: true,
      index: true,
    },
    provinceCode: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    matchStatus: {
      type: String,
      enum: ["matched", "ambiguous", "unmatched", "not_attempted"],
      default: "not_attempted",
      index: true,
    },
    matchMethod: {
      type: String,
      enum: ["postal_code", "fsa", "manual", "none"],
      default: "none",
    },
    confidence: {
      type: String,
      enum: ["high", "medium", "low", "none"],
      default: "none",
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "donation_riding_assignments",
  },
);

DonationRidingAssignmentSchema.index(
  {
    donationId: 1,
    boundarySet: 1,
  },
  { unique: true },
);

DonationRidingAssignmentSchema.index({
  donationYear: 1,
  boundarySet: 1,
  matchStatus: 1,
});

DonationRidingAssignmentSchema.index({
  ridingCode: 1,
  boundarySet: 1,
});

module.exports = mongoose.model(
  "DonationRidingAssignment",
  DonationRidingAssignmentSchema,
);
