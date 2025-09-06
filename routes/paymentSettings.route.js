import express from "express";
import {
  getPaymentSettings,
  updatePaymentSettings,
  getPublicPaymentSettings,
} from "../controller/paymentSettings.controller.js";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import { isAdmin } from "../middleware/authenticateAdmin.js";
import { upload } from "../utils/multer.config.js";

const router = express.Router();

// Admin routes - Protected by authentication and admin role
router.get("/admin/payment-settings", isAuthenticated, isAdmin, getPaymentSettings);
router.put("/admin/payment-settings", isAuthenticated, isAdmin, updatePaymentSettings);

// Public route - For users to get payment settings
router.get("/payment-settings", getPublicPaymentSettings);

export default router;
