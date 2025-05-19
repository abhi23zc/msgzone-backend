import { Router } from "express";
import { login, logout, profile, register } from "../controller/auth.controller.js";
import { isAuthenticated } from "../middleware/isAuthenticated.js";

const router = Router();

router.post("/login", login)
router.post("/register", register)
router.get("/profile", isAuthenticated ,profile)
router.get("/logout", isAuthenticated ,logout)

export default router;