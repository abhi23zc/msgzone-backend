import whatsapp from "whatsapp-web.js";
import { MessageLog } from "../models/message.log.schema.js";
import {
  addSession,
  getSession,
  removeSession,
  listSessions,
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

// 🔄 Create QR code & initialize WhatsApp session
export const scan = async (req, res) => {
  const userId = req?.user?.userId;
  const deviceId = req.body?.deviceId;
  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({ success: false, data: null, message: "User not found" });
  }
  if (!deviceId) {
    return res.status(400).json({ success: false, data : null, message: "Device ID required" });
  }
  try {
    const device = user?.devices?.find((device) => device?.deviceId === deviceId);
    if (device && device?.status === "connected") {
      return res.status(400).json({ success: false, data: null, message: "Device ID already exists" });
    }
    console.log("Generating QR for", userId, "Device:", deviceId);

    const sessionPath = path.join(
      __dirname,
      "..",
      ".wwebjs_auth",
      `session-${userId}-${deviceId}`
    );

    try {
      await fs.access(sessionPath);
      console.log("🧹 Removing existing session for", userId, deviceId);
      await fs.rm(sessionPath, { recursive: true, force: true });
    } catch {
      // Folder doesn't exist, ignore
    }

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: `${userId}-${deviceId}` }),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
      }
    });

    client.once("qr", async (qr) => {
      const qrImage = await qrcode.toDataURL(qr);
      console.log("QR Generated for", userId, "Device:", deviceId)
     
      res.json({ success: true, data: qrImage, message: "QR generated" });
    });

    client.on("ready", () => {
      if(device){
        device.status = "connected";
      }else{
        user.devices.push({ deviceId, status: "connected" });
      }
      console.log(`✅ WhatsApp ready for ${userId} (${deviceId})`);
    });

    client.on("auth_failure", (msg) => {
      if(device){
        device.status = "auth_failure";
      }else{
        user.devices.push({ deviceId, status: "auth_failure" });
      }
      console.error(`❌ Auth failure for ${userId} (${deviceId}):`, msg);
    });

    client.on("disconnected", (reason) => {
      if(device){
        device.status = "disconnected";
      }else{
        user.devices.push({ deviceId, status: "disconnected" });
      }
      console.warn(`⚠️ Client disconnected ${userId} (${deviceId}):`, reason);
      removeSession(userId, deviceId);
    });

    client.initialize();
    addSession(userId, deviceId, client);
    await user.save();
  } catch (err) {
    console.error("Scan Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to initialize WhatsApp session",
    });
  }
};

// 📤 Send message
export const send = async (req, res) => {
  const { numbers, message, timer, deviceId } = req.body;
  const userId = req.user.userId;

  if (!deviceId) return res.json({ success: false, message: "Device ID required" });
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

  return res.json({ success: true, data: messageLog, message: "Messages sent" });
};

// ⏰ Schedule message
export const scheduleMsg = async (req, res) => {
  const { number, message, scheduleTime, deviceId } = req.body;
  const userId = req.user.userId;

  if (!deviceId)
    return res.json({ success: false, message: "Device ID required" });

  const client = getSession(userId, deviceId);
  if (!client)
    return res.json({ success: false, message: "WhatsApp not connected" });

  const scheduledLog = await MessageLog.create({
    userId,
    number,
    message,
    status: "scheduled",
    scheduledTime: new Date(scheduleTime),
  });

  schedule.scheduleJob(new Date(scheduleTime), async () => {
    try {
      await client.sendMessage(number + "@c.us", message);
      await MessageLog.updateOne(
        { _id: scheduledLog._id },
        { status: "delivered", sentAt: new Date() }
      );
    } catch (err) {
      await MessageLog.updateOne(
        { _id: scheduledLog._id },
        { status: "error", sentAt: new Date() }
      );
    }
  });

  res.json({ success: true, data: scheduledLog, message: "Message scheduled" });
};

// 📜 Get message logs
export const getLogs = async (req, res) => {
  try {
    const logs = await MessageLog.find({ userId: req.user.userId }).sort({ sentAt: -1 });
    if (!logs.length) return res.json({ success: false, message: "No logs found" });
    return res.json({ success: true, data: logs });
  } catch (err) {
    console.error("Log error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch logs" });
  }
};

// 📋 List all active deviceIds for user
export const listUserSessions = async (req, res) => {
  const sessions = listSessions(req.user.userId);
  res.json({ success: true, data: sessions });
};
