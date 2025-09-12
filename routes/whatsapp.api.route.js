import express from 'express';
import { generateDeviceApiKey, getApiKeys, re_generateDeviceApiKey, sendMessageApi, sendMessageApiOld, deleteApiKey } from '../controller/_whatsapp.controller.js';
import { isApiAuthenticated } from '../middleware/apiAuthentication.js';
import { isAuthenticated } from '../middleware/isAuthenticated.js';
import { isApiAuthenticatedOld } from '../middleware/apiAuthenticationOld.js';
const router = express.Router();

router.get('/create-message',isApiAuthenticated,sendMessageApi)
router.get('/get-api-keys',isAuthenticated , getApiKeys)
router.post('/generate',isAuthenticated ,generateDeviceApiKey)
router.post('/re-generate',isAuthenticated ,re_generateDeviceApiKey)
router.delete('/delete/:apiKeyId',isAuthenticated ,deleteApiKey)

router.get('/',isApiAuthenticatedOld,sendMessageApiOld)

export default router;