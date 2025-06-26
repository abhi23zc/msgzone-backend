import express from "express";
import {
  createRazorpayOrder,
  verifyPayment,
  getAllPayments,
} from "../controller/payment.controller.js"
import { isAuthenticated  } from "../middleware/isAuthenticated.js";
import { isAdmin } from "../middleware/authenticateAdmin.js";

const router = express.Router();

// ✅Create Razorpay order
router.post("/create-order", isAuthenticated, createRazorpayOrder);

// ✅Verify payment & activate subscription
router.post("/verify-payment", isAuthenticated, verifyPayment);

// ✅Admin: Get all payments
router.get("/admin/payments", isAuthenticated, isAdmin, getAllPayments);

export default router;
