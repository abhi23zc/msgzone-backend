import whatsapp from "whatsapp-web.js";
import { MessageLog } from "../models/message.log.schema.js";
import {
  addSession,
  getSession,
  removeSession,
} from "../utils/sessions/sessionManager.js";
import schedule from "node-schedule";
import fs from "fs/promises";
const { Client, LocalAuth } = whatsapp;
import path from "path";
import { fileURLToPath } from "url";
import qrcode from "qrcode";
import { User } from "../models/user.Schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const scan = async (req, res) => {
  try {
    const userId = req?.user?.userId;
    const deviceId = req.body?.deviceId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        data: null,
        message: "Unauthorized - User ID missing",
      });
    }

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        data: null,
        message: "Device ID required",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        message: "User not found",
      });
    }

    const sessionKey = `${userId}-${deviceId}`;
    const existingClient = getSession(userId, deviceId);

    // Handle existing client cleanup
    if (existingClient) {
      console.log(existingClient);
      try {
        console.log(`🛑 Stopping existing WhatsApp client for ${sessionKey}`);
        await existingClient.destroy();
        removeSession(userId, deviceId);
        await delay(1000); // Allow puppeteer cleanup
      } catch (error) {
        console.error("Error destroying existing client:", error);
      }
    }

    // Clean up session folder
    const sessionPath = path.join(
      __dirname,
      "..",
      ".wwebjs_auth",
      `session-${sessionKey}`
    );
    try {
      await fs.access(sessionPath);
      console.log("🧹 Deleting old session folder for", sessionKey);
      await fs.rm(sessionPath, { recursive: true, force: true });
    } catch (err) {
      console.log("No session folder found. Proceeding...", err);
    }

    // Initialize new client with error handling
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: sessionKey,
      }),
      puppeteer: {
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        headless: true,
      },
    });

    // Set up event handlers with error catching
    client.once("qr", async (qr) => {
      try {
        const qrImage = await qrcode.toDataURL(qr);
        console.log("🔁 New QR Generated for", sessionKey);
        res.json({ success: true, data: qrImage, message: "QR generated" });
      } catch (error) {
        console.error("QR generation error:", error);
        res.status(500).json({
          success: false,
          message: "Failed to generate QR code",
        });
      }
    });

    client.on("ready", async () => {
      try {
        const device = user.devices.find((d) => d.deviceId === deviceId);
        if (device) {
          device.status = "connected";
        } else {
          user.devices.push({ deviceId, status: "connected" });
        }
        await User.findByIdAndUpdate(userId, { devices: user.devices });
        console.log(`✅ WhatsApp ready for ${sessionKey}`);
      } catch (error) {
        console.error("Error updating device status:", error);
      }
    });

    client.on("auth_failure", async (msg) => {
      try {
        const device = user.devices.find((d) => d.deviceId === deviceId);
        if (device) {
          device.status = "auth_failure";
        } else {
          user.devices.push({ deviceId, status: "auth_failure" });
        }
        await User.findByIdAndUpdate(userId, { devices: user.devices });

        console.log(`🛑 Stopping WhatsApp client for ${sessionKey}`);
        await client.destroy();
        removeSession(userId, deviceId);
        await delay(1000);

        console.error(`❌ Auth failure for ${sessionKey}:`, msg);
      } catch (error) {
        console.error("Error handling auth failure:", error);
      }
    });

    client.on("disconnected", async (reason) => {
      try {
        removeSession(userId, deviceId);
        const browser = client.pupBrowser;
        if (browser) {
          await browser.close();
        }

        if (client.pupBrowser?.process()) {
          client.pupBrowser.process().kill('SIGINT');
        }
        const sessionFolder = path.join(
          __dirname,
          "..",
          ".wwebjs_auth",
          `session-${sessionKey}`
        );
    
        try {
          await fs.rm(sessionFolder, { recursive: true, force: true });
          console.log("Session folder removed:", sessionFolder);
        } catch (fsErr) {
          console.warn("Failed to remove session folder:", fsErr.message);
        }
        
        // await safeDestroyClient(client, sessionKey);
        const device = user.devices.find((d) => d.deviceId === deviceId);
        if (device) {
          device.status = "disconnected";
        } else {
          user.devices.push({ deviceId, status: "disconnected" });
        }
        await User.findByIdAndUpdate(userId, { devices: user.devices });
        await delay(1000);

        console.warn(`⚠️ Client disconnected for ${sessionKey}:`, reason);
      } catch (error) {
        console.error("Error handling disconnection:", error);
      }
    });

    // Initialize client and save session
    try {
      await client.initialize();
      addSession(userId, deviceId, client);
      await user.save();
    } catch (error) {
      console.error("Client initialization error:", error);
      throw error; // Propagate to main error handler
    }
  } catch (err) {
    console.error("Scan Error:", err);
    // Ensure we send error response only if headers haven't been sent
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to initialize WhatsApp session",
        error: err.message,
      });
    }
  }
};

// 📤 Send Bulk message
export const sendBulk = async (req, res) => {
  const { numbers, message, timer, deviceId } = req.body;
  const userId = req.user.userId;

  if (!deviceId)
    return res.json({ success: false, message: "Device ID required" });
  const client = getSession(userId, deviceId);

  if (!client)
    return res.json({ success: false, message: "WhatsApp not connected" });

  if (!numbers || !message)
    return res.json({ success: false, message: "Missing fields" });

  const delayTime = parseInt(timer || "1") * 1000;
  const results = [];
  const messageLog = new MessageLog({ userId, messages: [] });

  for (const number of numbers) {
    const chatId = number + "@c.us";
    try {
      await client.sendMessage(chatId, message);
      results.push({
        number,
        text: message,
        status: "delivered",
        sendFrom: userId,
        sendTo: number,
      });
      await delay(delayTime);
    } catch (err) {
      results.push({ number, text: message, status: "error" });
    }
  }

  messageLog.messages = results;
  messageLog.status = "delivered";
  await messageLog.save();

  return res.json({
    success: true,
    data: messageLog,
    message: "Messages sent",
  });
};

//Send Single Message
export const sendSingle = async (req, res) => {
  const { number, message, timer, deviceId } = req.body;
  const userId = req.user.userId;

  if (!deviceId)
    return res.json({ success: false, message: "Device ID required" });
  const client = getSession(userId, deviceId);

  if (!client)
    return res.json({ success: false, message: "WhatsApp not connected" });

  if (!number || !message)
    return res.json({ success: false, message: "Missing fields" });

  const delayTime = parseInt(timer || "1") * 1000;
  const results = [];
  const messageLog = new MessageLog({ userId, messages: [] });
  const chatId = number + "@c.us";
  await client.sendMessage(chatId, message);
  results.push({
    number,
    text: message,
    status: "delivered",
    sendFrom: userId,
    sendTo: number,
  });
  await delay(delayTime);

  messageLog.messages = results;
  messageLog.status = "delivered";
  await messageLog.save();

  return res.json({
    success: true,
    data: messageLog,
    message: "Messages sent",
  });
};

export const scheduleMsg = async (req, res) => {
  const { number, message, scheduleTime, deviceId } = req.body;
  const userId = req.user.userId;

  if (!deviceId)
    return res.json({ success: false, message: "Device ID required" });

  const client = getSession(userId, deviceId);
  if (!client)
    return res.json({ success: false, message: "WhatsApp not connected" });

  const parsedDate = new Date(scheduleTime);
  if (isNaN(parsedDate)) {
    return res.json({ success: false, message: "Invalid date format" });
  }
  if (parsedDate < new Date()) {
    return res.json({ success: false, message: "Time must be in the future" });
  }

  const scheduledLog = await MessageLog.create({
    userId,
    number,
    message,
    status: "scheduled",
    scheduledTime: parsedDate,
  });

  const job = schedule.scheduleJob(parsedDate, async () => {
    try {
      console.log("✅ Scheduled job running at:", new Date());
      console.log("Sending message to", number + "@c.us");

      await client.sendMessage(number + "@c.us", message);
      await MessageLog.updateOne(
        { _id: scheduledLog._id },
        { status: "delivered", sentAt: new Date() }
      );
    } catch (err) {
      console.error("❌ Error sending message:", err);
      await MessageLog.updateOne(
        { _id: scheduledLog._id },
        { status: "error", sentAt: new Date() }
      );
    }
  });

  if (!job) {
    console.log("❌ Job was NOT scheduled.");
    return res.json({ success: false, message: "Failed to schedule job" });
  }

  console.log("✅ Job scheduled for:", parsedDate);

  res.json({ success: true, data: scheduledLog, message: "Message scheduled" });
};

// 📜 Get message logs
export const getLogs = async (req, res) => {
  try {
    const logs = await MessageLog.find({ userId: req.user.userId }).sort({
      sentAt: -1,
    });
    if (!logs.length)
      return res.json({ success: false, message: "No logs found" });
    return res.json({ success: true, data: logs });
  } catch (err) {
    console.error("Log error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch logs" });
  }
};

// 📋 List all active deviceIds for user
export const listUserSessions = async (req, res) => {
  const sessions = await User.findById(req.user.userId).select("devices");
  if (!sessions)
    return res.json({ success: false, message: "No sessions found" });
  res.json({ success: true, data: sessions, message: "Sessions listed" });
};
