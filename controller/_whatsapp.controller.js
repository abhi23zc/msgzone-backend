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
import { MessageLog } from "../models/_message.log.schema.js";
import logger from "../utils/logger.js";
import { User } from "../models/user.Schema.js";
import { generateApiKey } from "../utils/apikey.js";
import { ApiKey } from "../models/api.key.Schema.js";
import redis from "../utils/redis.js";
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

// ❌ Send message Old
// export const sendSingle = async (req, res) => {
//   const { deviceId, number, message, timer } = req.body;
//   const userId = req.user.userId;
//   if (!deviceId || !number || !message) {
//     return res
//       .status(400)
//       .json({ status: false, message: "Missing required fields" });
//   }
//   const clientId = `${req.user.userId}-${deviceId}`;

//   const session = getSession(clientId);
//   if (!session || !session.user) {
//     return res
//       .status(400)
//       .json({ status: false, message: "Client not logged in" });
//   }

//   const jid = number.includes("@s.whatsapp.net")
//     ? number
//     : `${number}@s.whatsapp.net`;
//   const messageLog = new MessageLog({ userId, messages: [] });
//   const results = [];
//   try {
//     const [result] = await session.sock.onWhatsApp(jid);
//     if (!result?.exists) {
//       results.push({
//         number,
//         text: message,
//         status: "error",
//         sendFrom: deviceId,
//         sendTo: number,
//       });
//       messageLog.messages = results;
//       messageLog.status = "error";
//       await messageLog.save();
//       return res.json({ status: true, message: "Message sent" });
//     }
//     await session.sock.sendMessage(jid, { text: message });
//     results.push({
//       number,
//       text: message,
//       status: "delivered",
//       sendFrom: deviceId,
//       sendTo: number,
//     });
//     messageLog.messages = results;
//     messageLog.status = "delivered";
//     await messageLog.save();

//     return res.json({ status: true, message: "Message sent" });
//   } catch (err) {
//     results.push({
//       number,
//       text: message,
//       status: "error",
//       sendFrom: deviceId,
//       sendTo: number,
//     });
//     messageLog.messages = results;
//     messageLog.status = "error";
//     await messageLog.save();
//     logger.error(`Send message failed : ${err.message}`);
//     return res
//       .status(500)
//       .json({ status: false, message: "Failed to send message" });
//   }
// };

// ✅ Send Single Message 
export const sendSingle = async (req, res) => {
  const { deviceId, number, message, timer } = req.body;
  const userId = req.user.userId;

  if (!deviceId || !number || !message) {
    return res.status(400).json({ status: false, message: "Missing required fields" });
  }

  const clientId = `${userId}-${deviceId}`;
  const session = getSession(clientId);

  if (!session || !session.user) {
    return res.status(400).json({ status: false, message: "Client not logged in" });
  }

  const jid = number.includes("@s.whatsapp.net") ? number : `${number}@s.whatsapp.net`;

  try {
    const [result] = await session.sock.onWhatsApp(jid);
    if (!result?.exists) {
      const failedLog = await MessageLog.create({
        userId,
        sendFrom: deviceId,
        sendTo: number,
        text: message,
        status: "error",
        errorMessage: "Number does not exist",
        type: "single",
      });

      return res.json({ status: true, message: "Number does not exist", logId: failedLog._id });
    }

    // If a timer (scheduledTime) is set, store and return early
    if (timer) {
      const scheduledLog = await MessageLog.create({
        userId,
        sendFrom: deviceId,
        sendTo: number,
        text: message,
        status: "scheduled",
        scheduledTime: new Date(timer),
        type: "single",
      });

      return res.json({ status: true, message: "Message scheduled", data:scheduledLog._id });
    }

    // Send message immediately
    await session.sock.sendMessage(jid, { text: message });

    const successLog = await MessageLog.create({
      userId,
      sendFrom: deviceId,
      sendTo: number,
      text: message,
      status: "delivered",
      sentAt: new Date(),
      type: "single",
    });

    return res.json({ status: true, message: "Message sent", logId: successLog._id });

  } catch (err) {
    logger.error(`Send message failed: ${err.message}`);

    const errorLog = await MessageLog.create({
      userId,
      sendFrom: deviceId,
      sendTo: number,
      text: message,
      status: "error",
      errorMessage: err.message,
      type: "single",
    });

    return res.status(500).json({ status: false, message: "Failed to send message", logId: errorLog._id });
  }
};


// ✅ Send BUlk Messages 
export const sendBulk = async (req, res) => {
  const { deviceId, numbers, message, timer } = req.body;
  const userId = req.user.userId;

  if (!deviceId || !numbers || !Array.isArray(numbers) || numbers.length === 0 || !message) {
    return res.status(400).json({ status: false, message: "Missing or invalid fields" });
  }

  // Default delay to 0ms if not provided
  const delayMs = parseInt(timer*1000) || 1000;

  const clientId = `${userId}-${deviceId}`;
  const session = getSession(clientId);

  if (!session || !session.user) {
    return res.status(400).json({ status: false, message: "Client not logged in" });
  }

  const logs = [];

  for (const number of numbers) {
    const jid = number.includes("@s.whatsapp.net") ? number : `${number}@s.whatsapp.net`;

    try {
      const [result] = await session.sock.onWhatsApp(jid);

      if (!result?.exists) {
        const failedLog = await MessageLog.create({
          userId,
          sendFrom: deviceId,
          sendTo: number,
          text: message,
          status: "error",
          errorMessage: "Number does not exist",
          type: "bulk",
        });

        logs.push({ number, status: "error", logId: failedLog._id });
        continue;
      }

      // Send message immediately
      await session.sock.sendMessage(jid, { text: message });

      const successLog = await MessageLog.create({
        userId,
        sendFrom: deviceId,
        sendTo: number,
        text: message,
        status: "delivered",
        sentAt: new Date(),
        type: "bulk",
      });

      logs.push({ number, status: "delivered", logId: successLog._id });

    } catch (err) {
      logger.error(`Bulk message failed for ${number}: ${err.message}`);

      const errorLog = await MessageLog.create({
        userId,
        sendFrom: deviceId,
        sendTo: number,
        text: message,
        status: "error",
        errorMessage: err.message,
        type: "bulk",
      });

      logs.push({ number, status: "error", logId: errorLog._id });
    }

    // Wait for delay between messages
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return res.json({
    status: true,
    message: "Bulk message process completed",
    results: logs,
  });
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


//📜 Whatsapp api's endpoints started

// ✅ Send Message API
export const sendMessageApi = async (req, res) => {
  try {
    const { apikey, to: numberRaw, message: rawMessage } = req.query;
    const userId = req?.userId;
    const deviceId = req?.deviceId;

    if (!userId) return res.status(401).json({ status: false, message: "Invalid user" });
    if (!apikey || !numberRaw || !rawMessage || !deviceId) {
      return res.status(400).json({ status: false, message: "Missing required fields" });
    }

    const number = decodeURIComponent(numberRaw);
    const message = decodeURIComponent(rawMessage);
    const clientId = `${userId}-${deviceId}`;

    const session = getSession(clientId);
    if (!session || !session.user) {
      return res.status(400).json({ status: false, message: "Client not logged in" });
    }

    const jid = number.includes("@s.whatsapp.net") ? number : `${number}@s.whatsapp.net`;

    const [result] = await session.sock.onWhatsApp(jid);
    const logData = {
      userId,
      sendFrom: deviceId,
      sendTo: number,
      text: message,
      type: "single",
      sendThrough: "api",
    };

    // Case: WhatsApp number does not exist
    if (!result?.exists) {
      logData.status = "error";
      logData.errorMessage = "WhatsApp number does not exist";
      await MessageLog.create(logData);

      return res.json({
        status: false,
        message: "WhatsApp number does not exist",
      });
    }

    // Try sending the message
    await session.sock.sendMessage(jid, { text: message });

    logData.status = "delivered";
    logData.sentAt = new Date();
    await MessageLog.create(logData);

    return res.json({
      status: true,
      message: "Message sent successfully",
    });
  } catch (err) {
    const { userId, deviceId } = req;

    // Save error log
    await MessageLog.create({
      userId,
      sendFrom: deviceId,
      sendTo: req.query.to,
      text: req.query.message,
      type: "single",
      status: "error",
      sendThrough: "api",
      errorMessage: err.message,
    });

    // Log error to console or custom logger
    console.error("Failed to send message:", err);

    return res.status(500).json({
      status: false,
      message: "Failed to send message",
    });
  }
};

// ✅ Generate API KEY
export const generateDeviceApiKey = async (req, res) => {
  const { deviceId } = req.body || {};
  const userId = req.user?.userId;

  if (!deviceId) {
    return res.status(400).json({ message: "Device ID is required" });
  }
  const user = await User.findById(userId);
  if (!user) {
    return res
      .status(404)
      .json({ status: false, data: null, message: "User not found" });
  }
  const deviceExists = user.devices.some((d) => d.deviceId === deviceId);
  if (!deviceExists) {
    return res.status(400).json({ message: "Invalid device ID" });
  }
  const apiKeyExists = await ApiKey.findOne({ deviceId, userId });
  if (apiKeyExists)
    return res
      .status(400)
      .json({ status: false, data: null, message: "Api key already exists" });

  const rawKey = generateApiKey();
  // const hashedKey = hashApiKey(rawKey);

  await ApiKey.create({
    apiKey: rawKey,
    deviceId,
    userId,
    status: "active",
  });

  return res.status(201).json({
    status: true,
    message: "Api key generated succesfully",
    data: { apiKey: rawKey, deviceId },
  });
};

// ✅Regenerate API KEY
export const re_generateDeviceApiKey = async (req, res) => {
  const { deviceId } = req.body || {};
  const userId = req.user?.userId;
  if (!deviceId) {
    return res.status(400).json({ message: "Device ID is required" });
  }
  const user = await User.findById(userId);
  if (!user) {
    return res
      .status(404)
      .json({ status: false, data: null, message: "User not found" });
  }
  const deviceExists = user.devices.some((d) => d.deviceId === deviceId);
  if (!deviceExists) {
    return res.status(400).json({ message: "Invalid device ID" });
  }
  const apiKeyExists = await ApiKey.findOne({ deviceId, userId });
  if (!apiKeyExists)
    return res
      .status(400)
      .json({ status: false, data: null, message: "Api key not found" });
  const redisKey = `apikey:${apiKeyExists?.apiKey}`;
  console.log(redisKey);
  await redis.del(redisKey);
  const rawKey = generateApiKey();
  // const hashedKey = hashApiKey(rawKey);
  apiKeyExists.apiKey = rawKey;
  apiKeyExists.status = "active";
  apiKeyExists.createdAt = Date.now();
  await apiKeyExists.save();

  return res.status(201).json({
    status: true,
    message: "Api key regenerated succesfully",
    data: { apiKey: rawKey, deviceId },
  });
};

// ✅ Get API KEYS
export const getApiKeys = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const apiKeys = await ApiKey.find({ userId });
    return res
      .status(200)
      .json({ status: true, data: apiKeys, message: "API keys fetched" });
  } catch (error) {
    logger.error(`Failed to fetch API keys: ${error.message}`);
    return res
      .status(500)
      .json({ status: false, data: null, message: "Failed to fetch API keys" });
  }
};

// ❌ Save this endpoint for older version
export const sendMessageApiOld = async (req, res) => {
  let { apikey, to: number, message, deviceId } = req.query;

  const userId = req.user.userId;

  if (!apikey || !number || !message || !deviceId) {
    return res
      .status(400)
      .json({ status: false, message: "Missing required fields" });
  }

  // Decode message text if present
  if (message) {
    message = decodeURIComponent(message);
  }

  const clientId = `${userId}-${deviceId}`;
  const session = getSession(clientId);

  if (!session || !session.user) {
    return res
      .status(400)
      .json({ status: false, message: "Client not logged in" });
  }

  const jid = number.includes("@s.whatsapp.net")
    ? number
    : `${number}@s.whatsapp.net`;

  try {
    const [result] = await session.sock.onWhatsApp(jid);
    if (!result?.exists) {
      // Save message log with error status
      const messageLog = new MessageLog({
        userId,
        sendFrom: deviceId,
        sendTo: number,
        text: message || "",
        status: "error",
        sendThrough: "api",
        errorMessage: "Recipient does not exist on WhatsApp",
      });
      await messageLog.save();

      return res.json({ status: false, message: "Recipient not found" });
    }


    await session.sock.sendMessage(jid, {text: message});

    // Save success log
    const messageLog = new MessageLog({
      userId,
      sendFrom: deviceId,
      sendTo: number,
      text: message || "",
      status: "delivered",
      sendThrough: "api",
      sentAt: new Date(),
    });

    await messageLog.save();

    res.json({ status: true, message: "Message sent" });
  } catch (err) {
    // Save error log
    const messageLog = new MessageLog({
      userId,
      sendFrom: deviceId,
      sendTo: number,
      text: message || "",
      status: "error",
      sendThrough: "api",
      errorMessage: "Internal Error",
    });

    await messageLog.save();

    logger.error(`Send message failed: ${err.message}`);
    res.status(500).json({ status: false, message: "Failed to send message" });
  }
};

