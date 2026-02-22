import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import importRoutes from "./importRoutes.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/import", importRoutes);

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/api/ping", (req, res) => {
  res.json({ message: "pong", ts: new Date().toISOString() });
});

const PORT = process.env.PORT || 5020;
app.listen(PORT, () => console.log(`API running on :${PORT}`));
