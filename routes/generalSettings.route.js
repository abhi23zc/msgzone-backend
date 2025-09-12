import express from "express";
import {
  getGeneralSettings,
  updateGeneralSettings,
  getPublicGeneralSettings,
  getGeneralSettingsHistory,
  uploadLogo,
} from "../controller/generalSettings.controller.js";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import { isAdmin } from "../middleware/authenticateAdmin.js";
import { upload } from "../utils/multer.config.js";

const router = express.Router();

// Admin routes - Protected by authentication and admin role
router.get("/admin/general-settings", isAuthenticated, isAdmin, getGeneralSettings);
router.put("/admin/general-settings", isAuthenticated, isAdmin, updateGeneralSettings);
router.post("/admin/general-settings/upload-logo", isAuthenticated, isAdmin, upload.single('logo'), uploadLogo);
router.get("/admin/general-settings/history", isAuthenticated, isAdmin, getGeneralSettingsHistory);

// Public route - For users to get general settings
router.get("/general-settings", getPublicGeneralSettings);

export default router;
