import express from "express";
import {
  getDashboardStats,
  getWeeklyMessageStats,
  getUserGrowthStats,
  getLiveActivity,
  setAdminDevice,
} from "../controller/admin.controller.js";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import { isAdmin } from "../middleware/authenticateAdmin.js";
import { createUser, deleteUser, getAllUsers, getUserStats, updateUser } from "../controller/admin_user.controller.js";
import { 
  getMessageReportStats, 
  getMessageReportList, 
  exportReportCSV, 
  exportReportExcel 
} from "../controller/admin.report.controller.js";
import { assignPlanToUser, createPlan, deletePlan, getAllPlans, updatePlan, reorderPlans } from "../controller/admin.plan.controller.js";

const router = express.Router();

// ✅ Dashboard Routes
router.get("/dashboard-stats", isAuthenticated, isAdmin, getDashboardStats);
router.get(
  "/weekly-message-stats",
  isAuthenticated,
  isAdmin,
  getWeeklyMessageStats
);
router.get("/user-growth", isAuthenticated, isAdmin, getUserGrowthStats);
router.get("/activity", isAuthenticated, isAdmin, getLiveActivity);

// ✅Check Admin

router.get('/isAdmin', isAuthenticated , isAdmin, (req, res)=>{
  return res.json({status:true, message:"Admin is authenticated", data:null})
})

// ✅ User Routes
router.get("/users/stats", isAuthenticated, isAdmin, getUserStats);
router.get("/users",  isAuthenticated, isAdmin,  getAllUsers);
router.post("/users",  isAuthenticated, isAdmin,  createUser);
router.put("/users/:id",  isAuthenticated, isAdmin,  updateUser);
router.delete("/users/:id",  isAuthenticated, isAdmin,  deleteUser);


// ✅ Reports Routes
router.get("/reports/stats", isAuthenticated, isAdmin,getMessageReportStats);
router.get("/reports/list", isAuthenticated, isAdmin,getMessageReportList);

// Add these new routes for export functionality
router.get("/reports/export/csv", isAuthenticated, isAdmin, exportReportCSV);
router.get("/reports/export/excel", isAuthenticated, isAdmin, exportReportExcel);


// ✅ Plan Management
router.post("/plans", isAuthenticated, isAdmin, createPlan);
router.get("/plans", isAuthenticated, getAllPlans);
router.put("/plans/reorder", isAuthenticated, isAdmin, reorderPlans);
router.put("/plans/:id", isAuthenticated, isAdmin, updatePlan);
router.delete("/plans/:id", isAuthenticated, isAdmin, deletePlan);

// ✅ Assign Plan to User
router.post("/assign-plan", isAuthenticated, isAdmin, assignPlanToUser);

// ✅ Settings
router.post("/setAdminDevice", isAuthenticated, isAdmin, setAdminDevice);

export default router;
