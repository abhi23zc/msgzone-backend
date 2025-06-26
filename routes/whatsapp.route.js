import express from 'express';
const router = express.Router();

import { isAuthenticated } from '../middleware/isAuthenticated.js';

// import { getLogs, listUserSessions,  scan, scheduleMsg, sendBulk } from '../controller/whatsapp.controller.js';
import { start , connect, sendSingle, getLogs, listUserSessions, sendBulk, sendSingleSchedule, sendBulkSchedule, deleteDevice} from '../controller/_whatsapp.controller.js';
import { upload } from '../utils/multer.config.js';

router.post('/start', isAuthenticated, start);
router.post('/connect', isAuthenticated, connect);
router.post('/delete', isAuthenticated, deleteDevice);
 
router.post('/sendSingle', isAuthenticated , upload.array("attachments", 10) ,sendSingle);
router.post('/scheduleSingle', isAuthenticated, upload.array("attachments", 10), sendSingleSchedule);

router.post('/sendBulk', isAuthenticated ,upload.array("attachments", 10) , sendBulk);
router.post('/scheduleBulk', isAuthenticated ,upload.array("attachments", 10) , sendBulkSchedule);


router.get('/logs', isAuthenticated, getLogs)
router.get('/getDevices', isAuthenticated, listUserSessions)


export default router;