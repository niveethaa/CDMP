require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || "0.0.0.0";

// Fail fast if the JWT secret is missing: without it, token signing/verification
// would break at request time and surface as confusing 500s instead of a clear
// configuration error at boot.
if (!process.env.JWT_SECRET) {
  console.error(
    "Missing required environment variable JWT_SECRET. Set it before starting the server.",
  );
  process.exit(1);
}

async function startServer() {
  await connectDB();

  app.listen(PORT, HOST, () => {
    console.log(`Server running on ${HOST}:${PORT}`);
    console.log("Express says: API is running");
  });
}

startServer().catch((error) => {
  console.error("Server failed to start.");
  console.error(error.message);
  process.exit(1);
});
