import { Router } from "express";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import { getAllMessages } from "../controller/dashboard.controller.js";

const router = Router();

router.get('/getAllMessages', isAuthenticated, getAllMessages)

export default router