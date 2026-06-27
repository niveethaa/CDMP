const mongoose = require("mongoose");

const PopulationSchema = new mongoose.Schema(
  {
    year: {
      type: Number,
      required: true,
    },
    population: {
      type: Number,
      required: true,
    },
  },
  { _id: false },
);

const PointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator(value) {
          return (
            Array.isArray(value) &&
            value.length === 2 &&
            Number.isFinite(value[0]) &&
            Number.isFinite(value[1])
          );
        },
        message: "Coordinates must be [longitude, latitude].",
      },
    },
  },
  { _id: false },
);

const RegionSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      required: true,
      enum: ["national", "province", "riding"],
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    provinceCode: {
      type: String,
      trim: true,
      index: true,
      uppercase: true,
    },
    provinceName: {
      type: String,
      trim: true,
    },
    boundarySet: {
      type: String,
      trim: true,
      index: true,
    },
    geometryRef: {
      type: String,
      trim: true,
    },
    centroid: {
      type: PointSchema,
      default: undefined,
    },
    populationHistory: {
      type: [PopulationSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "regions",
  },
);

RegionSchema.index(
  {
    level: 1,
    code: 1,
    boundarySet: 1,
  },
  { unique: true },
);

RegionSchema.index({ level: 1, name: 1 });
RegionSchema.index({ centroid: "2dsphere" });

module.exports = mongoose.model("Region", RegionSchema);
