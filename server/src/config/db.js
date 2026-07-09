const mongoose = require("mongoose");

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI;
  const requireMongo = process.env.REQUIRE_MONGODB === "true";

  if (!mongoUri) {
    const message =
      "MONGODB_URI is missing. Server will run without database connection.";
    if (requireMongo) {
      throw new Error(message);
    }
    console.warn(message);
    return;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected successfully.");
  } catch (error) {
    if (requireMongo) {
      throw error;
    }
    console.warn("MongoDB connection failed. Server will still start.");
    console.warn(error.message);
  }
}

module.exports = connectDB;
