import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  delay,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MessageLog } from "../models/message.log.schema.js";
import logger from "../utils/logger.js";
import { User } from "../models/user.Schema.js";

const sessions = {};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Create client
export async function createClient(clientId) {
  try {
    const [userId, deviceId] = clientId?.split("-");
    const sessionFolder = path.join(__dirname, "..", "sessions", clientId);

    logger.info(`Creating session for: ${clientId}`);
    const user = await User.findById(userId);
    // Ensure session directory exists
    if (!fs.existsSync(sessionFolder)) {
      fs.mkdirSync(sessionFolder, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      generateHighQualityLinkPreview: true,
      getMessage: async () => ({}),
    });

    // Setup session
    sessions[clientId] = {
      sock,
      qr: null,
      qrGeneratedAt: null,
      user: null,
      qrTimeout: null,
    };

    sock.ev.on(
      "connection.update",
      async ({ connection, qr, lastDisconnect }) => {
        try {
          if (qr && connection !== "open" && !sessions[clientId].qr) {
            const qrImage = await qrcode.toDataURL(qr);
            sessions[clientId].qr = qrImage;
            sessions[clientId].qrGeneratedAt = Date.now();
            logger.info(`[${clientId}] QR generated`);

            // ⏲️ Set a timeout to destroy unscanned session
            sessions[clientId].qrTimeout = setTimeout(() => {
              if (!sessions[clientId]?.user) {
                logger.warn(
                  `[${clientId}] QR not scanned in time. Destroying session.`
                );
                destroySession(clientId);
              }
            }, 30 * 1000); // Timeout
          }

          if (connection === "open") {
            sessions[clientId].user = sock.user;
            sessions[clientId].qr = null;
            sessions[clientId].qrGeneratedAt = null;

            // ✅ Clear QR timeout
            if (sessions[clientId].qrTimeout) {
              clearTimeout(sessions[clientId].qrTimeout);
              sessions[clientId].qrTimeout = null;
            }
            const device = user.devices.find((d) => d.deviceId === deviceId);
            if (device) {
              device.status = "connected";
            } else {
              user.devices.push({ deviceId, status: "connected" });
            }
            await User.findByIdAndUpdate(userId, { devices: user.devices });

            logger.info(`[${clientId}] Logged in as ${sock.user.id}`);
          }

          if (connection === "close") {
            const shouldReconnect =
              lastDisconnect?.error?.output?.statusCode !==
              DisconnectReason.loggedOut;
            logger.warn(
              `[${clientId}] Connection closed. Reconnect: ${shouldReconnect}`
            );
            delete sessions[clientId];

            if (shouldReconnect) {
              const credFile = path.join(sessionFolder, "creds.json");
              if (fs.existsSync(credFile)) {
                logger.info(`[${clientId}] Attempting reconnection...`);
                await createClient(clientId);
              }
            } else {
              setTimeout(() => {
                fs.rm(
                  sessionFolder,
                  { recursive: true, force: true },
                  (err) => {
                    if (err)
                      logger.error(`Failed to remove session: ${err.message}`);
                    else
                      logger.info(`Session folder removed: ${sessionFolder}`);
                  }
                );
              }, 1000);

              const device = user.devices.find((d) => d.deviceId === deviceId);
              if (device) {
                device.status = "disconnected";
              } else {
                user.devices.push({ deviceId, status: "disconnected" });
              }
              await User.findByIdAndUpdate(userId, { devices: user.devices });
            }
          }
        } catch (err) {
          logger.error(`Connection update error: ${err.message}`);
        }
      }
    );

    sock.ev.on("creds.update", async () => {
      try {
        if (!fs.existsSync(sessionFolder)) {
          fs.mkdirSync(sessionFolder, { recursive: true });
        }
        await saveCreds();
      } catch (err) {
        logger.error(`Failed to save credentials: ${err.message}`);
      }
    });
  } catch (err) {
    logger.error(`Client creation failed: ${err.message}`);
    throw err;
  }
}

// ✅ Get session
export function getSession(clientId) {
  return sessions[clientId] || null;
}

// ❌ Destroy session
export function destroySession(clientId) {
  if (sessions[clientId]) {
    sessions[clientId].sock.logout().catch(() => {});
    if (sessions[clientId]?.qrTimeout) {
      clearTimeout(sessions[clientId].qrTimeout);
    }
    delete sessions[clientId];

    const sessionPath = path.join(__dirname, "..", "sessions", clientId);
    fs.rmSync(sessionPath, { recursive: true, force: true });

    logger.info(`Session ${clientId} destroyed`);
  }
}

// ✅ Start Session for client
export const start = async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId)
      return res
        .status(400)
        .json({ status: false, message: "Device ID required" });

    const clientId = `${req.user.userId}-${deviceId}`;
    if (sessions[clientId])
      return res.status(200).json({
        status: false,
        message: "Client already connected",
        data: "null",
      });
    await createClient(clientId);

    const session = getSession(clientId);
    res.json({
      status: true,
      message: "QR generated successfully",
      data: session.qr,
    });
  } catch (err) {
    logger.error(err);
    res
      .status(500)
      .json({ status: false, message: "Failed to start client", data: null });
  }
};

// ✅ Get QR for client
export const connect = async (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId)
    return res
      .status(400)
      .json({ status: false, message: "Device ID required" });

  const clientId = `${req.user.userId}-${deviceId}`;
  const session = getSession(clientId);
  if (!session)
    return res
      .status(404)
      .json({ status: false, message: "Client not found", data: null });
  if (session?.qr)
    return res
      .status(200)
      .json({ status: true, message: "QR generated", data: session.qr });
  if (session?.user)
    return res
      .status(200)
      .json({ status: false, message: "Client already connected", data: null });

  return res
    .status(200)
    .json({ status: false, message: "Failed to generate QR", data: null });
};

// ✅ Send message
export const sendSingle = async (req, res) => {
  const { deviceId, number, message, timer } = req.body;
  const userId = req.user.userId;
  if (!deviceId || !number || !message) {
    return res
      .status(400)
      .json({ status: false, message: "Missing required fields" });
  }
  const clientId = `${req.user.userId}-${deviceId}`;

  const session = getSession(clientId);
  if (!session || !session.user) {
    return res
      .status(400)
      .json({ status: false, message: "Client not logged in" });
  }

  const jid = number.includes("@s.whatsapp.net")
    ? number
    : `${number}@s.whatsapp.net`;
  const messageLog = new MessageLog({ userId, messages: [] });
  const results = [];
  try {
    const [result] = await session.sock.onWhatsApp(jid);
    if (!result?.exists) {
      results.push({
        number,
        text: message,
        status: "error",
        sendFrom: deviceId,
        sendTo: number,
      });
      messageLog.messages = results;
      messageLog.status = "error";
      await messageLog.save();
      return res.json({ status: true, message: "Message sent" });

    }
    await session.sock.sendMessage(jid, { text: message });
    results.push({
      number,
      text: message,
      status: "delivered",
      sendFrom: deviceId,
      sendTo: number,
    });
    messageLog.messages = results;
    messageLog.status = "delivered";
    await messageLog.save();

    return res.json({ status: true, message: "Message sent" });
  } catch (err) {
    results.push({
      number,
      text: message,
      status: "error",
      sendFrom: deviceId,
      sendTo: number,
    });
    messageLog.messages = results;
    messageLog.status = "error";
    await messageLog.save();
    logger.error(`Send message failed : ${err.message}`);
    return res.status(500).json({ status: false, message: "Failed to send message" });
  }
};

// ✅ Logout & delete session
export const logout = async (req, res) => {
  const { clientId } = req.body;
  destroySession(clientId);
  res.json({ status: true, message: "Client logged out" });
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
  await delay(3000);
  res.json({ success: true, data: sessions, message: "Sessions listed" });
};




// Whatsapp api's endpoints
export const sendMessageApi = async (req, res) => {
  const { apikey, to:number, message, deviceId } = req.query;

  // const { deviceId, number, message, timer } = req.body;
  const userId = req.user.userId;
  if (!apikey || !number || !message || !deviceId) {
    return res
      .status(400)
      .json({ status: false, message: "Missing required fields" });
  }
  const clientId = `${req.user.userId}-${deviceId}`;

  const session = getSession(clientId);
  if (!session || !session.user) {
    return res
      .status(400)
      .json({ status: false, message: "Client not logged in" });
  }

  const jid = number.includes("@s.whatsapp.net")
    ? number
    : `${number}@s.whatsapp.net`;
  const messageLog = new MessageLog({ userId, messages: [] });
  const results = [];
  try {
    const [result] = await session.sock.onWhatsApp(jid);
    if (!result?.exists) {
      results.push({
        number,
        text: message,
        status: "error",
        sendFrom: deviceId,
        sendTo: number,
      });
      messageLog.messages = results;
      messageLog.status = "error";
      await messageLog.save();
      return res.json({ status: true, message: "Message sent" });
    }
    await session.sock.sendMessage(jid, { text: message });
    results.push({
      number,
      text: message,
      status: "delivered",
      sendFrom: deviceId,
      sendTo: number,
    });
    messageLog.messages = results;
    messageLog.status = "delivered";
    await messageLog.save();

    res.json({ status: true, message: "Message sent" });
  } catch (err) {
    results.push({
      number,
      text: message,
      status: "error",
      sendFrom: deviceId,
      sendTo: number,
    });
    messageLog.messages = results;
    messageLog.status = "error";
    await messageLog.save();
    logger.error(`Send message failed: ${err.message}`);
    res.status(500).json({ status: false, message: "Failed to send message" });
  }
};
