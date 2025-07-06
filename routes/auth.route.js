import { Router } from "express";
import { enable91, login, logout, profile, register, sendOtp, verifyOtp, forgotPassword, verifyResetOtp, resetPassword } from "../controller/auth.controller.js";
import { isAuthenticated } from "../middleware/isAuthenticated.js";

const router = Router();

router.post("/login", login)
router.post("/register", register)
router.get("/profile", isAuthenticated ,profile)
router.get("/logout", isAuthenticated ,logout)
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.get("/enable91", isAuthenticated,enable91);

// Reset password routes
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);

export default router;