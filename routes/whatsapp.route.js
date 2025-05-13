import express from 'express';
const router = express.Router();

import { isAuthenticated } from '../middleware/isAuthenticated.js';

import { getLogs, scan, scheduleMsg, send } from '../controller/whatsapp.controller.js';



router.get('/scan', isAuthenticated, scan);

// router.get('/scan', isAuthenticated, async (req, res) => {
//   const userId = req.user.userId;
//   const sessionPath = path.join(__dirname, '..', '.wwebjs_auth', `session-${userId}`);

//   res.setHeader('Content-Type', 'text/event-stream');
//   res.setHeader('Cache-Control', 'no-cache');
//   res.setHeader('Connection', 'keep-alive');
//   res.flushHeaders(); // Needed for SSE to start sending data

//   const sendEvent = (event, data) => {
//     res.write(`event: ${event}\n`);
//     res.write(`data: ${JSON.stringify(data)}\n\n`);
//   };

//   try {
//     try {
//       await fs.access(sessionPath);
//       console.log(`Removing existing session for ${userId} to regenerate QR`);
//       await fs.rm(sessionPath, { recursive: true, force: true });
//     } catch (err) {
//       // No session folder exists
//     }

//     const client = new Client({
//       authStrategy: new LocalAuth({ clientId: userId }),
//     });

//     client.on('qr', async (qr) => {
//       console.log("QR generated for:", userId);
//       const qrImage = await qrcode.toDataURL(qr);
//       sendEvent("qr", { qr: qrImage });
//     });

//     client.on('ready', () => {
//       console.log(`WhatsApp client ready for user ${userId}`);
//       sendEvent("ready", { message: "Client is ready" });
//       res.end(); // Close the SSE connection
//     });

//     client.on('auth_failure', (msg) => {
//       console.error(`Auth failure for user ${userId}:`, msg);
//       sendEvent("error", { message: "Auth failure" });
//       res.end();
//     });

//     client.on('disconnected', (reason) => {
//       console.warn(`Client disconnected for ${userId}:`, reason);
//       sendEvent("error", { message: "Disconnected" });
//       res.end();
//     });

//     client.initialize();
//     addSession(userId, client);
//   } catch (err) {
//     console.error("Error in /scan SSE route:", err);
//     sendEvent("error", { message: "Server error during scan" });
//     res.end();
//   }
// });

router.post('/send', isAuthenticated ,send);

router.post('/schedule', isAuthenticated, scheduleMsg);

router.get('/logs', isAuthenticated, getLogs)

export default router;