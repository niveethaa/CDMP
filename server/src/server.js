require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || "0.0.0.0";

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
