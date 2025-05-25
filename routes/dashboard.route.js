import { Router } from "express";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import { getAllMessages, getTodayMessages } from "../controller/dashboard.controller.js";

const router = Router();

router.get('/getAllMessages', isAuthenticated, getAllMessages)
router.get('/getTodayMessages', isAuthenticated, getTodayMessages)

export default router