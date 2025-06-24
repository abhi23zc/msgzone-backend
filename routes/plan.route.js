import express from "express";

import { isAuthenticated } from "../middleware/isAuthenticated.js";
import { getAllPlans } from "../controller/admin.plan.controller.js";
import { getUserActivePlan } from "../controller/plan.controller.js";

const router = express.Router();


// ✅Get ALL Plans
router.get("/", isAuthenticated, getAllPlans);


// ✅Get User Active Plan
router.get("/subscription", isAuthenticated, getUserActivePlan);



export default router;
