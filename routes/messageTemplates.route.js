import express from "express";
import { getMessageTemplates, updateMessageTemplates } from "../controller/messageTemplates.controller.js";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import { isAdmin } from "../middleware/authenticateAdmin.js";

const router = express.Router();

// GET /admin/message-templates - Get all message templates
router.get("/message-templates", isAuthenticated, isAdmin, getMessageTemplates);

// PUT /admin/message-templates - Update message templates
router.put("/message-templates", isAuthenticated, isAdmin, updateMessageTemplates);

export default router;
