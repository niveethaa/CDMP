const mongoose = require("mongoose");

const ReferenceDataBatchSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    sourcePath: {
      type: String,
      trim: true,
    },
    referenceType: {
      type: String,
      enum: [
        "boundary_set",
        "riding_regions",
        "postal_riding_mapping",
        "population",
        "other",
      ],
      required: true,
      index: true,
    },
    boundarySet: {
      type: String,
      trim: true,
      index: true,
    },
    rowCount: {
      type: Number,
      default: 0,
    },
    importedCount: {
      type: Number,
      default: 0,
    },
    skippedCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    errorMessage: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "reference_data_batches",
  },
);

ReferenceDataBatchSchema.index(
  {
    fileName: 1,
    referenceType: 1,
    boundarySet: 1,
  },
  { unique: true },
);

module.exports = mongoose.model("ReferenceDataBatch", ReferenceDataBatchSchema);
