const mongoose = require("mongoose");

const RidingCandidateSchema = new mongoose.Schema(
  {
    ridingCode: {
      type: String,
      required: true,
      trim: true,
    },
    ridingName: {
      type: String,
      required: true,
      trim: true,
    },
    provinceCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    weight: {
      type: Number,
      default: 1,
    },
  },
  { _id: false },
);

const PostalRidingMappingSchema = new mongoose.Schema(
  {
    postalCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    fsa: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    provinceCode: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    boundarySet: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    candidates: {
      type: [RidingCandidateSchema],
      default: [],
    },
    candidateCount: {
      type: Number,
      default: 0,
    },
    matchStatus: {
      type: String,
      enum: ["unique", "ambiguous", "unmatched"],
      default: "unmatched",
      index: true,
    },
    source: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "postal_riding_mappings",
  },
);

PostalRidingMappingSchema.index(
  {
    postalCode: 1,
    boundarySet: 1,
  },
  { unique: true },
);

PostalRidingMappingSchema.index({
  fsa: 1,
  boundarySet: 1,
});

module.exports = mongoose.model(
  "PostalRidingMapping",
  PostalRidingMappingSchema,
);
