import "dotenv/config"; // 🔥 MUST BE FIRST

import express from "express";
import extractVinRoute from "./routes/extractVin";

import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger";

const app = express();

app.use(express.json());

app.use(extractVinRoute);

// Swagger
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

const PORT = 3002;

app.listen(PORT, () => {
  console.log(`VIN extractor running on port ${PORT}`);
});