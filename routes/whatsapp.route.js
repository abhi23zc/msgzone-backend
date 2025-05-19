import express from 'express';
const router = express.Router();

import { isAuthenticated } from '../middleware/isAuthenticated.js';

// import { getLogs, listUserSessions,  scan, scheduleMsg, sendBulk } from '../controller/whatsapp.controller.js';
import { start , connect, sendSingle, getLogs, listUserSessions} from '../controller/_whatsapp.controller.js';

router.post('/start', isAuthenticated, start);
router.post('/connect', isAuthenticated, connect);

router.post('/sendSingle', isAuthenticated ,sendSingle);

// router.post('/sendBulk', isAuthenticated ,sendBulk);

// router.post('/schedule', isAuthenticated, scheduleMsg);

router.get('/logs', isAuthenticated, getLogs)

router.get('/getDevices', isAuthenticated, listUserSessions)

export default router;