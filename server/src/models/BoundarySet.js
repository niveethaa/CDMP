const mongoose = require("mongoose");

const BoundarySetSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    level: {
      type: String,
      enum: ["national", "province", "riding"],
      default: "riding",
      index: true,
    },
    validFromYear: {
      type: Number,
      required: true,
      index: true,
    },
    validToYear: {
      type: Number,
      default: null,
      index: true,
    },
    source: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "boundary_sets",
  },
);

BoundarySetSchema.index({ validFromYear: 1, validToYear: 1 });

module.exports = mongoose.model("BoundarySet", BoundarySetSchema);
