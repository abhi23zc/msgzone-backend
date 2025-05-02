import express from 'express';
const router = express.Router();
import whatsapp from 'whatsapp-web.js';
import qrcode from 'qrcode';
import schedule from 'node-schedule';
import { addSession, getSession } from '../utils/sessions/sessionManager.js';
import { isAuthenticated } from '../middleware/isAuthenticated.js';
import { MessageLog } from '../models/message.log.schema.js';
import { UserAuthStrategy } from '../utils/UserAuthStrategy.js'

const { Client, LocalAuth, RemoteAuth } = whatsapp

// router.post('/scan', isAuthenticated, async (req, res) => {
//   const userId = req.user.userId;
//   console.log("Starting WhatsApp session for:", userId);

//   const auth = new UserAuthStrategy(userId);

//   const client = new Client({
//     authStrategy: new RemoteAuth({
//       store: auth, // Use UserAuthStrategy for session management
//       clientId: `user-${userId}`, // Unique client ID for each user
//       backupSyncIntervalMs: 300000,
//     }),
//     puppeteer: { headless: true },
//   });

//   client.once('qr', async (qr) => {
//     const qrImage = await qrcode.toDataURL(qr);
//     res.send(`<img src="${qrImage}" alt="Scan QR" />`);
//   });

//   client.on('ready', () => {
//     console.log(`WhatsApp client ready for user ${userId}`);
//   });

//   client.on('auth_failure', () => {
//     console.log(`Auth failure for ${userId}`);
//   });

//   client.initialize();
// });

router.post('/scan', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log("🔄 Starting WhatsApp session for:", userId);

    const store = new UserAuthStrategy(userId);
    const client = new Client({
      authStrategy: new RemoteAuth({
        clientId: userId,
        store: store,
        backupSyncIntervalMs: 300000, // Optional autosave every 5 min
      })
    });

    client.once('qr', async (qr) => {
      try {
        console.log("📷 QR generated for:", userId);
        const qrImage = await qrcode.toDataURL(qr);
        res.send(`<img src="${qrImage}" alt="Scan QR Code to login to WhatsApp" />`);
      } catch (err) {
        console.error("Error generating QR code:", err);
        res.status(500).json({ error: 'Failed to generate QR code' });
      }
    });

    client.on('ready', () => {
      try {
        console.log(`✅ WhatsApp client ready for user ${userId}`);
      } catch (err) {
        console.error("Error in ready event:", err);
      }
    });

    client.on('auth_failure', (msg) => {
      try {
        console.error(`❌ Auth failure for user ${userId}:`, msg);
      } catch (err) {
        console.error("Error in auth_failure event:", err);
      }
    });

    client.on('disconnected', (reason) => {
      try {
        console.warn(`⚠️ Client disconnected for ${userId}:`, reason);
      } catch (err) {
        console.error("Error in disconnected event:", err);
      }
    });

    try {
      client.initialize();
      addSession(userId, client);
    } catch (err) {
      console.error("Error initializing client:", err);
      res.status(500).json({ error: 'Failed to initialize WhatsApp client' });
    }
  } catch (err) {
    console.error("Error in /scan route:", err);
    res.status(500).json({ error: 'Failed to start WhatsApp session' });
  }
});


const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

router.post('/send', isAuthenticated, async (req, res) => {
  try {
    const { numbers, message } = req.body;
    const client = getSession(req.user.userId);

    if (!client) return res.status(404).json({ error: 'WhatsApp not connected' });

    const results = [];
    const messageLog = new MessageLog({
        userId: req.user.userId,
        messages :  [],
        status: 'scheduled'
      });

    for (const number of numbers) {
      const chatId = number + '@c.us';

      try {
        await client.sendMessage(chatId, message);
        results.push({ text: message });

      } catch (err) {
        results.push({ number, status: 'error', reason: err.message });
      }

      await delay(3000); 
    }

    messageLog.messages = results;
    await messageLog.save();
    return res.json({ success: true, messageLog });
  } catch (err) {
    console.error("Error in /send route:", err);
    res.status(500).json({ error: 'Failed to send messages' });
  }
});

// Schedule message
router.post('/schedule', isAuthenticated, async (req, res) => {
  try {
    const { number, message, scheduleTime } = req.body;
    const client = getSession(req.user.userId);
    if (!client) return res.status(404).json({ error: 'WhatsApp not connected' });

    try {
      await MessageLog.create({
        userId: req.user.userId,
        number,
        message,
        status: 'scheduled',
        scheduledTime: new Date(scheduleTime),
      });
    } catch (err) {
      console.error("Error creating MessageLog:", err);
      return res.status(500).json({ error: 'Failed to create message log' });
    }

    try {
      schedule.scheduleJob(new Date(scheduleTime), async () => {
        try {
          const chatId = number + '@c.us';
          await client.sendMessage(chatId, message);
          await MessageLog.updateOne(
            { userId: req.user.userId, number, message, scheduledTime: new Date(scheduleTime) },
            { status: 'delivered', sentAt: new Date() }
          );
        } catch (err) {
          try {
            await MessageLog.updateOne(
              { userId: req.user.userId, number, message, scheduledTime: new Date(scheduleTime) },
              { status: 'error', sentAt: new Date() }
            );
          } catch (updateErr) {
            console.error("Error updating MessageLog after failed send:", updateErr);
          }
        }
      });
    } catch (err) {
      console.error("Error scheduling job:", err);
      return res.status(500).json({ error: 'Failed to schedule message' });
    }

    res.json({ scheduled: true });
  } catch (err) {
    console.error("Error in /schedule route:", err);
    res.status(500).json({ error: 'Scheduling failed' });
  }
});

// Get message logs
router.get('/logs', isAuthenticated, async (req, res) => {
  try {
    try {
      const logs = await MessageLog.find({ userId: req.user.userId }).sort({ sentAt: -1 });
      res.json(logs);
    } catch (err) {
      console.error("Error fetching logs:", err);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  } catch (err) {
    console.error("Error in /logs route:", err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});


export default router;