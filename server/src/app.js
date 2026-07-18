const express = require("express");
const cors = require("cors");
const healthRoutes = require("./routes/health.routes");
const regionsRoutes = require("./routes/regions.routes");
const authRoutes = require("./routes/auth.routes");
const researchRoutes = require("./routes/research.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/regions", regionsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/research", researchRoutes);


app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});

module.exports = app;