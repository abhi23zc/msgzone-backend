import express from "express";
import {
  createRazorpayOrder,
  verifyPayment,
  getAllPayments,
  createManualPayment,
  approveManualPayment,
  rejectManualPayment,
  getPaymentsStats,
  getUserPayments
} from "../controller/payment.controller.js";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import { isAdmin } from "../middleware/authenticateAdmin.js";
import { upload } from "../utils/multer.config.js";

const router = express.Router();

// ✅Create Razorpay order
router.post("/create-order", isAuthenticated, createRazorpayOrder);

// ✅Verify payment & activate subscription
router.post("/verify-payment", isAuthenticated, verifyPayment);

// Get user payment history
router.get("/user-payments", isAuthenticated, getUserPayments);

// ✅Admin: Get all payments
router.get("/admin/payments", isAuthenticated, isAdmin, getAllPayments);

// ✅Create Manual payment
router.post("/manual-payment", isAuthenticated, upload.single('screenshot'), createManualPayment);

// ✅Approve Manual Payment
router.put(
  "/admin/approve-payment/:paymentId",
  isAuthenticated,
  isAdmin,
  approveManualPayment
);

// ✅Reject Manual Payment
router.put(
  "/admin/reject-payment/:paymentId",
  isAuthenticated,
  isAdmin,
  rejectManualPayment
);

// ✅ Get All Payments
router.get("/admin", isAuthenticated, isAdmin, getPaymentsStats);

export default router;
