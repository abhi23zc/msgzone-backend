import express from "express";

import { isAuthenticated } from "../middleware/isAuthenticated.js";
import { getAllPlans } from "../controller/admin.plan.controller.js";
import { getUserActivePlan, getUserSubscriptions, switchToNextPlan } from "../controller/plan.controller.js";

const router = express.Router();


// ✅Get ALL Plans
router.get("/", isAuthenticated, getAllPlans);


// ✅Get User Active Plan
router.get("/subscription", isAuthenticated, getUserActivePlan);
// ✅Get all User Subscriptions
router.get("/allsubscription", isAuthenticated, getUserSubscriptions);

// ✅Activate Next Plan
router.post("/switch-plan", isAuthenticated, switchToNextPlan);



export default router;
