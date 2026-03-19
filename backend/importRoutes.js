import express from "express";
import importCrudRoutes from "./routes/importCrudRoutes.js";
import importFileRoutes from "./routes/importFileRoutes.js";
import importMappingRoutes from "./routes/importMappingRoutes.js";

const router = express.Router();

router.use("/", importCrudRoutes);
router.use("/", importFileRoutes);
router.use("/", importMappingRoutes);

export default router;