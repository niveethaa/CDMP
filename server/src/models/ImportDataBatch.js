const mongoose = require("mongoose");

const ImportDataBatchSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    source: {
      type: String,
      required: true,
      trim: true,
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },
    partyCode: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    dataEra: {
      type: String,
      enum: ["modern", "pre_2004", "unknown"],
      default: "unknown",
    },
    rowCount: {
      type: Number,
      required: true,
      default: 0,
    },
    importedCount: {
      type: Number,
      required: true,
      default: 0,
    },
    skippedCount: {
      type: Number,
      required: true,
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
    collection: "import_data_batches",
  },
);

ImportDataBatchSchema.index({ year: 1, partyCode: 1 });

module.exports = mongoose.model("ImportDataBatch", ImportDataBatchSchema);
