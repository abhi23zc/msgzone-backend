import { Router } from "express";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import { getAllMessages, getTodayMessages , getTodayMessageCount, getTotalMessageCount, exportMessagesToCSV} from "../controller/dashboard.controller.js";

const router = Router();

router.get('/getAllMessages', isAuthenticated, getAllMessages)
router.get('/getTodayMessages', isAuthenticated, getTodayMessages)
router.get('/getAllMessagesCount', isAuthenticated, getTotalMessageCount)
router.get('/getTodayMessagesCount', isAuthenticated, getTodayMessageCount)
router.get('/export/csv', isAuthenticated, exportMessagesToCSV)

export default router