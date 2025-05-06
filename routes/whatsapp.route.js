import express from 'express';
const router = express.Router();
import whatsapp from 'whatsapp-web.js';
import qrcode from 'qrcode';
import schedule from 'node-schedule';
import { addSession, getSession } from '../utils/sessions/sessionManager.js';
import { isAuthenticated } from '../middleware/isAuthenticated.js';
import { MessageLog } from '../models/message.log.schema.js';

const { Client, LocalAuth, RemoteAuth } = whatsapp

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get('/scan', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.userId;
    const sessionPath = path.join(__dirname, '..', '.wwebjs_auth', `session-${userId}`);

    try {
      await fs.access(sessionPath);
      console.log(`🧹 Removing existing session for ${userId} to regenerate QR`);
      await fs.rm(sessionPath, { recursive: true, force: true });
    } catch (err) {
      // No session folder exists
    }

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: userId }),
    });

    
    client.once('qr', async (qr) => {
      try {
        console.log("📷 QR generated for:", userId);
        const qrImage = await qrcode.toDataURL(qr);
        res.json({ success: true, data: qrImage, message: "QR generated" });
      } catch (err) {
        console.error("Error generating QR code:", err);
        res.json({ success: false, data: null, message: "Failed to generate QR" });
      }
    });

    client.on('ready', () => {
      console.log(`✅ WhatsApp client ready for user ${userId}`);
    });

    client.on('auth_failure', (msg) => {
      console.error(`❌ Auth failure for user ${userId}:`, msg);
    });

    client.on('disconnected', (reason) => {
      console.warn(`⚠️ Client disconnected for ${userId}:`, reason);
    });

    client.initialize();
    addSession(userId, client);
  } catch (err) {
    console.error("Error in /scan route:", err);
    res.status(500).json({ success: false, data: null, message: 'Failed to start WhatsApp session' });
  }
});

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

router.post('/send', isAuthenticated, async (req, res) => {
  try {
    const { numbers, message, timer } = req.body;
    // console.log(numbers, message, timer);
    if (!numbers || !message) {
      return res.json({ success: false, data: null, message: 'Please fill all required fields' });
    }
    let newTimer = 1;
    if (timer) newTimer = timer;
    const client = getSession(req.user.userId);

    if (!client) {
      return res.json({ success: false, data: null, message: 'WhatsApp not connected' });
    }

    const results = [];
    const messageLog = new MessageLog({
      userId: req.user.userId,
      messages: [],
      status: 'scheduled'
    });

    for (const number of numbers) {
      // if (!Number.isInteger(number)) continue;
      const chatId = number + '@c.us';

      try {
        await client.sendMessage(chatId, message);
        console.log("Message Sent", { chatId, message });
        await delay(parseInt(newTimer)*1000);
        results.push({ number, text: message, status: 'delivered' });
      } catch (err) {
        console.log(err)
        results.push({ number, text: message, status: 'error' });
      }
    }

    if(!results){
      return res.json({ success: false, data: null, message: "Something went wrong while sending messages" });
    }
    messageLog.messages = results;
    await messageLog.save();
    return res.json({ success: true, data: messageLog, message: "Messages sent" });
  } catch (err) {
    console.error("Error in /send route:", err);
    return res.status(500).json({ success: false, data: null, message: 'Failed to send messages' });
  }
});

router.post('/schedule', isAuthenticated, async (req, res) => {
  try {
    const { number, message, scheduleTime } = req.body;
    const client = getSession(req.user.userId);
    if (!client) {
      return res.json({ success: false, data: null, message: 'WhatsApp not connected' });
    }

    let scheduledLog;
    try {
      scheduledLog = await MessageLog.create({
        userId: req.user.userId,
        number,
        message,
        status: 'scheduled',
        scheduledTime: new Date(scheduleTime),
      });
    } catch (err) {
      console.error("Error creating MessageLog:", err);
      return res.json({ success: false, data: null, message: 'Failed to create message log' });
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
      return res.json({ success: false, data: null, message: 'Failed to schedule message' });
    }

    return res.json({ success: true, data: scheduledLog, message: "Message scheduled" });
  } catch (err) {
    console.error("Error in /schedule route:", err);
    return res.status(500).json({ success: false, data: null, message: 'Scheduling failed' });
  }
});

router.get('/logs', isAuthenticated, async (req, res) => {
  try {
    try {
      const logs = await MessageLog.find({ userId: req.user.userId }).sort({ sentAt: -1 });
      if (!logs || logs.length === 0) {
        return res.json({ success: false, data: null, message: "No Messages found" });
      }
      return res.json({ success: true, data: logs, message: "Logs fetched" });
    } catch (err) {
      console.error("Error fetching logs:", err);
      return res.json({ success: false, data: null, message: 'Failed to fetch logs' });
    }
  } catch (err) {
    console.error("Error in /logs route:", err);
    return res.status(500).json({ success: false, data: null, message: 'Failed to fetch logs' });
  }
});

export default router;