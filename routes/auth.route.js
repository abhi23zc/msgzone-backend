import { Router } from "express";
import { login, logout, profile, register, sendOtp, verifyOtp } from "../controller/auth.controller.js";
import { isAuthenticated } from "../middleware/isAuthenticated.js";

const router = Router();

router.post("/login", login)
router.post("/register", register)
router.get("/profile", isAuthenticated ,profile)
router.get("/logout", isAuthenticated ,logout)
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);

export default router;