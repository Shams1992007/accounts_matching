import express from "express";
import importCrudRoutes from "./routes/importCrudRoutes.js";
import importFileRoutes from "./routes/importFileRoutes.js";
import importMappingRoutes from "./routes/importMappingRoutes.js";
import rowEditRoutes from "./routes/rowEditRoutes.js";

const router = express.Router();

router.use("/", importCrudRoutes);
router.use("/", importFileRoutes);
router.use("/", importMappingRoutes);
router.use("/", rowEditRoutes);

export default router;