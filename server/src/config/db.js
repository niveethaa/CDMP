const mongoose = require("mongoose");

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.warn(
      "MONGODB_URI is missing. Server will run without database connection.",
    );
    return;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected successfully.");
  } catch (error) {
    console.warn("MongoDB connection failed. Server will still start.");
    console.warn(error.message);
  }
}

module.exports = connectDB;
