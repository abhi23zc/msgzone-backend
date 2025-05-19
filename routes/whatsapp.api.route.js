import express from 'express';
import { sendMessageApi } from '../controller/_whatsapp.controller.js';
import { isApiAuthenticated } from '../middleware/apiAuthentication.js';
const router = express.Router();

router.get('/',isApiAuthenticated,sendMessageApi)

export default router;