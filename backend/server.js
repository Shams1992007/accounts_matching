import "dotenv/config";
import express from "express";
import cors from "cors";
import importRoutes from "./importRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/api/ping", (req, res) => {
  res.json({ message: "pong", ts: new Date().toISOString() });
});

app.use("/api/import", importRoutes);

const PORT = process.env.PORT || 5020;
app.listen(PORT, () => console.log(`API running on :${PORT}`));