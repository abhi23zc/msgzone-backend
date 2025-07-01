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
import { messageQueue } from "../utils/messageQueue.js";
import { v4 as uuid } from "uuid";
import { worker } from "../utils/messageWorker.js";
import moment from "moment";
import { htmlToWhatsapp } from "../utils/htmltoWhatsapp.js";
import {
  canSendMessage,
  incrementMessageCount,
} from "../middleware/sendMessage.js";
import { checkDevice } from "../middleware/checkDevice.js";

const sessions = {};

const reconnectionAttempts = {};
const MAX_RETRIES = 3;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

worker.on("completed", (job) => {
  console.log(`✅ Job completed: ${job.id}`);
});
worker.on("failed", (job, err) => {
  console.log(`❌ Job failed: ${job.id}, Reason: ${err.message}`);
});

// ✅ Create client
export async function createClient(clientId) {
  if (sessions[clientId]?.sock?.user) {
    logger.info(`[${clientId}] Session already connected. Skipping creation.`);
    return;
  }

  const memBefore = process.memoryUsage().rss;
  const [userId, deviceId] = clientId?.split("-");
  const sessionFolder = path.join(__dirname, "..", "sessions", clientId);

  try {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    if (!fs.existsSync(sessionFolder)) {
      fs.mkdirSync(sessionFolder, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      getMessage: async () => undefined,
      generateHighQualityLinkPreview: false,
      shouldSyncHistoryMessage: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      msgRetryCounterMap: {},
    });

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
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          const shouldReconnect = !isLoggedOut;

          // QR Code Generation
          if (qr && connection !== "open" && !sessions[clientId].qr) {
            const qrImage = await qrcode.toDataURL(qr);
            sessions[clientId].qr = qrImage;
            sessions[clientId].qrGeneratedAt = Date.now();
            logger.info(`[${clientId}] QR generated`);

            sessions[clientId].qrTimeout = setTimeout(() => {
              if (!sessions[clientId]?.user) {
                logger.warn(`[${clientId}] QR expired. Destroying session.`);
                destroySession(clientId);
              }
            }, 30 * 1000);
          }

          // On Connect
          if (connection === "open") {
            sessions[clientId].user = sock.user;
            sessions[clientId].qr = null;
            if (sessions[clientId].qrTimeout) {
              clearTimeout(sessions[clientId].qrTimeout);
            }
            reconnectionAttempts[clientId] = 0;

            const device = user.devices.find((d) => d.deviceId === deviceId);
            if (device) device.status = "connected";
            else
              user.devices.push({
                deviceId,
                status: "connected",
                number: sock.user.id.split(":")[0],
              });

            await user.save();
            logger.info(`[${clientId}] Connected as ${sock.user.id}`);
          }

          // On Disconnect
          if (connection === "close") {
            logger.warn(
              `[${clientId}] Connection closed. Reconnect: ${shouldReconnect}`
            );
            delete sessions[clientId];

            // Update DB status
            const device = user.devices.find((d) => d.deviceId === deviceId);
            if (device) device.status = "disconnected";
            else user.devices.push({ deviceId, status: "disconnected" });
            await user.save();

            // If logout → destroy session & folder
            if (isLoggedOut) {
              logger.info(`[${clientId}] Logged out. Destroying session.`);
              await destroySession(clientId);
              return;
            }

            // Try reconnecting
            reconnectionAttempts[clientId] =
              (reconnectionAttempts[clientId] || 0) + 1;
            if (reconnectionAttempts[clientId] <= MAX_RETRIES) {
              logger.warn(
                `[${clientId}] Reconnecting (${reconnectionAttempts[clientId]}/${MAX_RETRIES})`
              );
              await createClient(clientId);
            } else {
              logger.error(`[${clientId}] Max reconnect attempts reached.`);
            }
          }
        } catch (err) {
          logger.error(`[${clientId}] connection.update error: ${err.message}`);
        }
      }
    );

    sock.ev.on("creds.update", async () => {
      try {
        if (!fs.existsSync(sessionFolder))
          fs.mkdirSync(sessionFolder, { recursive: true });
        await saveCreds();
      } catch (err) {
        logger.error(`[${clientId}] Failed to save creds: ${err.message}`);
      }
    });

    const memAfter = process.memoryUsage().rss;
    logger.info(
      `[${clientId}] Memory used: ${(memAfter - memBefore) / 1024 / 1024} MB`
    );
  } catch (err) {
    logger.error(`[${clientId}] Client creation failed: ${err.message}`);
    throw err;
  }
}

// ✅Create Client New
// export async function createClient(clientId) {
//   const memBefore = process.memoryUsage().rss;

//   try {
//     const [userId, deviceId] = clientId?.split("-");
//     const sessionFolder = path.join(__dirname, "..", "sessions", clientId);

//     logger.info(`Creating session for: ${clientId}`);
//     const user = await User.findById(userId);

//     if (!fs.existsSync(sessionFolder)) {
//       fs.mkdirSync(sessionFolder, { recursive: true });
//     }

//     const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
//     const { version } = await fetchLatestBaileysVersion();

//     const sock = makeWASocket({
//       version,
//       auth: state,
//       printQRInTerminal: false,
//       getMessage: async () => undefined,
//       generateHighQualityLinkPreview: false,
//       shouldSyncHistoryMessage: false,
//       syncFullHistory: false,
//       markOnlineOnConnect: false,
//       msgRetryCounterMap: {},
//     });

//     sessions[clientId] = {
//       sock,
//       qr: null,
//       qrGeneratedAt: null,
//       user: null,
//       qrTimeout: null,
//     };

//     sock.ev.on("connection.update", async ({ connection, qr, lastDisconnect }) => {
//       try {
//         if (qr && connection !== "open" && !sessions[clientId].qr) {
//           const qrImage = await qrcode.toDataURL(qr);
//           sessions[clientId].qr = qrImage;
//           sessions[clientId].qrGeneratedAt = Date.now();
//           logger.info(`[${clientId}] QR generated`);

//           sessions[clientId].qrTimeout = setTimeout(() => {
//             if (!sessions[clientId]?.user) {
//               logger.warn(`[${clientId}] QR not scanned in time. Destroying session.`);
//               destroySession(clientId);
//             }
//           }, 30 * 1000);
//         }

//         if (connection === "open") {
//           reconnectAttempts[clientId] = 0; // Reset on success
//           sessions[clientId].user = sock.user;
//           sessions[clientId].qr = null;
//           sessions[clientId].qrGeneratedAt = null;

//           if (sessions[clientId].qrTimeout) {
//             clearTimeout(sessions[clientId].qrTimeout);
//             sessions[clientId].qrTimeout = null;
//           }

//           const device = user.devices.find((d) => d.deviceId === deviceId);
//           if (device) {
//             device.status = "connected";
//           } else {
//             user.devices.push({ deviceId, status: "connected" });
//           }
//           await User.findByIdAndUpdate(userId, { devices: user.devices });

//           logger.info(`[${clientId}] Logged in as ${sock.user.id}`);
//         }

//         if (connection === "close") {
//           logger.warn(`[${clientId}] Disconnect reason:`, lastDisconnect?.error);

//           const shouldReconnect =
//             lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

//           logger.warn(`[${clientId}] Connection closed. Reconnect: ${shouldReconnect}`);

//           if (sock?.end) sock.end();
//           delete sessions[clientId];

//           if (shouldReconnect) {
//             reconnectAttempts[clientId] = (reconnectAttempts[clientId] || 0) + 1;

//             if (reconnectAttempts[clientId] > MAX_RECONNECT_ATTEMPTS) {
//               logger.error(
//                 `[${clientId}] Reconnect attempts exceeded (${MAX_RECONNECT_ATTEMPTS}). Stopping session.`
//               );
//               return;
//             }

//             logger.info(`[${clientId}] Reconnect attempt ${reconnectAttempts[clientId]}`);
//             setTimeout(async () => {
//               try {
//                 await createClient(clientId);
//               } catch (err) {
//                 logger.error(`Retry reconnect failed for ${clientId}: ${err.message}`);
//               }
//             }, 5000);
//           } else {
//             setTimeout(() => {
//               fs.rm(sessionFolder, { recursive: true, force: true }, (err) => {
//                 if (err) logger.error(`Failed to remove session: ${err.message}`);
//                 else logger.info(`Session folder removed: ${sessionFolder}`);
//               });
//             }, 1000);

//             const device = user.devices.find((d) => d.deviceId === deviceId);
//             if (device) {
//               device.status = "disconnected";
//             } else {
//               user.devices.push({ deviceId, status: "disconnected" });
//             }
//             await User.findByIdAndUpdate(userId, { devices: user.devices });
//           }
//         }
//       } catch (err) {
//         logger.error(`Connection update error: ${err.message}`);
//       }
//     });

//     sock.ev.on("creds.update", async () => {
//       try {
//         if (!fs.existsSync(sessionFolder)) {
//           fs.mkdirSync(sessionFolder, { recursive: true });
//         }
//         await saveCreds();
//       } catch (err) {
//         logger.error(`Failed to save credentials: ${err.message}`);
//       }
//     });

//     const memAfter = process.memoryUsage().rss;
//     logger.info(`[${clientId}] Memory used: ${(memAfter - memBefore) / 1024 / 1024} MB`);
//   } catch (err) {
//     logger.error(`Client creation failed: ${err.message}`);
//     throw err;
//   }
// }

// ✅ Get session
export function getSession(clientId) {
  return sessions[clientId] || null;
}

// ❌ Destroy session
export async function destroySession(clientId) {
  const session = sessions[clientId];
  if (!session) {
    logger.warn(`No session found to destroy for ${clientId}`);
  } else delete sessions[clientId];

  const [userId, deviceId] = clientId.split("-");

  try {
    // Disconnect and cleanup
    await session.sock?.logout?.().catch(() => {});
    session.sock?.ws?.close?.();
    session.sock?.ev?.removeAllListeners?.();
    if (session.qrTimeout) clearTimeout(session.qrTimeout);
  } catch (e) {
    logger.warn(`[${clientId}] Error during logout: ${e.message}`);
  }

  // Delete session folder
  const sessionPath = path.join(__dirname, "..", "sessions", clientId);
  console.log("Session Path", sessionPath);
  try {
    fs.rmSync(sessionPath, { recursive: true, force: true });
    logger.info(`[${clientId}] Session folder removed`);
  } catch (e) {
    logger.warn(`[${clientId}] Failed to remove folder: ${e.message}`);
  }

  // Update MongoDB device status
  try {
    const user = await User.findById(userId);
    if (user) {
      const device = user.devices.find((d) => d.deviceId === deviceId);
      if (device) {
        device.status = "disconnected";
        await user.save();
        logger.info(`[${clientId}] Device marked as disconnected in DB`);
      }
    }
  } catch (e) {
    logger.error(`[${clientId}] Failed to update MongoDB: ${e.message}`);
  }

  logger.info(`✅ Session ${clientId} fully destroyed`);
}

// ✅ Start Session for client
export const start = async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId)
      return res
        .status(400)
        .json({ status: false, message: "Device ID required" });
    const check = await checkDevice(req.user.userId, deviceId);
    if (!check.allowed) {
      return res.status(403).json({ success: false, message: check.reason });
    }

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

//✅ Delete Device
export const deleteDevice = async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({
        status: false,
        message: "Device ID is required",
      });
    }

    const userId = req.user.userId;
    const clientId = `${userId}-${deviceId}`;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    user.devices = user?.devices?.filter(
      (device) => device.deviceId != deviceId
    );
    await user.save();
    await destroySession(clientId);

    return res.status(200).json({
      status: true,
      message: "Device deleted successfully",
    });
  } catch (error) {
    logger.error(`Error deleting device: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: "Failed to delete device",
      data: null,
    });
  }
};

// ✅ Send Single Message
export const sendSingle = async (req, res) => {
  const { deviceId, number, message } = req.body;
  let captions = req.body.captions || [];
  const attachments = req.files;
  const userId = req.user.userId;
  captions = [...captions];
  if (!deviceId || !number) {
    if (attachments?.length)
      attachments.forEach((file) => fs.unlinkSync(file.path));
    return res
      .status(400)
      .json({ status: false, message: "Missing required fields" });
  }

  const tempAttachments =
    attachments?.length > 0 &&
    attachments.map((file) => ({
      path: file.path,
      mimetype: file.mimetype,
      originalname: file.originalname,
    }));

  try {
    await messageQueue.add(
      "message-queue",
      {
        userId,
        deviceId,
        enableCode: req.user.enableCode,
        number,
        req:req.user,
        message: htmlToWhatsapp(message),
        captions,
        attachments: tempAttachments || [],
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
        removeOnFail: true,
      }
    );
    console.log("📤 Job added to queue ✅");
    return res
      .status(200)
      .json({ status: true, message: "Message Sent Succesfully", data: null });
  } catch (error) {
    console.error("❌ Failed to add job to queue:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to queue message",
      error: error.message,
    });
  }
};

// ✅ Send Single Message Schedule
export const sendSingleSchedule = async (req, res) => {
  const { deviceId, number, message, schedule } = req.body;
  let captions = req.body.captions || [];
  const attachments = req.files;
  const userId = req.user.userId;

  let scheduledAt = null;

  captions = [...captions];

  if (!deviceId || !number) {
    if (attachments?.length)
      attachments.forEach((file) => fs.unlinkSync(file.path));
    return res.status(400).json({
      status: false,
      message: "Missing required fields",
    });
  }
  const check = await canSendMessage(req, userId);
  if (!check.allowed) {
    return res.status(403).json({ success: false, message: check.reason });
  }

  if (schedule) {
    const validFormat = moment(schedule, moment.ISO_8601, true).isValid();
    if (!validFormat) {
      return res.status(400).json({
        status: false,
        message:
          "Invalid schedule format. Use ISO 8601 format (e.g., '2023-12-31T23:59:59Z')",
      });
    }

    if (moment(schedule).isBefore(moment())) {
      return res.status(400).json({
        status: false,
        message: "Schedule time must be in the future",
      });
    }
  }

  const tempAttachments =
    (attachments?.length > 0 &&
      attachments?.map((file) => ({
        path: file.path,
        mimetype: file.mimetype,
        originalname: file.originalname,
      }))) ||
    [];

  try {
    const jobOptions = {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
      removeOnFail: true,
    };

    // Add delay if scheduled
    if (schedule) {
      const delay = moment(schedule).diff(moment(), "milliseconds");
      jobOptions.delay = delay;
      scheduledAt = new Date(schedule);
    }

    await messageQueue.add(
      "message-queue",
      {
        userId,
        deviceId,
        enableCode: req.user.enableCode,
        number,
        req:req.user,
        message: htmlToWhatsapp(message),
        captions,
        attachments: tempAttachments || [],
        isScheduled: !!schedule,
        scheduledAt,
      },
      jobOptions
    );

    console.log(
      `📤 Job added ${schedule ? `(scheduled for ${schedule})` : ""} ✅`
    );
    return res.status(200).json({
      status: true,
      message: schedule ? "Message scheduled" : "Message queued",
      data: { schedule },
    });
  } catch (error) {
    console.error("❌ Failed to add job to queue:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to queue message",
      error: error.message,
    });
  }
};

// ❌ Send BUlk Messages Outdated
export const sendBulk1 = async (req, res) => {
  const { deviceId, numbers, message, timer } = req.body;
  const userId = req.user.userId;

  if (
    !deviceId ||
    !numbers ||
    !Array.isArray(numbers) ||
    numbers.length === 0 ||
    !message
  ) {
    return res
      .status(400)
      .json({ status: false, message: "Missing or invalid fields" });
  }

  // Default delay to 0ms if not provided
  const delayMs = parseInt(timer * 1000) || 1000;

  const clientId = `${userId}-${deviceId}`;
  const session = getSession(clientId);

  if (!session || !session.user) {
    return res
      .status(400)
      .json({ status: false, message: "Client not logged in" });
  }

  const logs = [];

  for (const number of numbers) {
    const jid = number.includes("@s.whatsapp.net")
      ? number
      : `${number}@s.whatsapp.net`;

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
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return res.json({
    status: true,
    message: "Bulk message process completed",
    results: logs,
  });
};

// ✅ Send BUlk Messages
export const sendBulk = async (req, res) => {
  try {
    const { deviceId, message, timer } = req.body;
    let numbers = req.body.numbers || [];
    let captions = req.body.captions || [];
    const attachments = req.files; // array of files
    const userId = req.user.userId;

    numbers = JSON.parse(numbers);
    numbers = Array.isArray(numbers) ? numbers : [numbers];
    captions = Array.isArray(captions) ? captions : [captions];

    if (!deviceId || !numbers.length) {
      if (attachments?.length) {
        attachments.forEach((file) => fs.unlinkSync(file.path));
      }
      return res
        .status(400)
        .json({ status: false, message: "Missing required fields" });
    }

    const tempAttachments =
      attachments?.length > 0 &&
      attachments.map((file) => ({
        path: file.path,
        mimetype: file.mimetype,
        originalname: file.originalname,
      }));

    await messageQueue.add(
      "message-queue",
      {
        userId,
        deviceId,
        req:req.user,
        enableCode: req.user.enableCode,
        numbers,
        message: htmlToWhatsapp(message),
        captions,
        attachments: tempAttachments || [],
        type: "bulk",
        timer: timer || 1,
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
        removeOnFail: true,
      }
    );

    return res.json({
      status: true,
      message: "Bulk message sent Succesfully",
      data: null,
    });
  } catch (error) {
    console.error("Failed to send bulk messages:", error);

    // Cleanup any uploaded files if there was an error
    if (req.files?.length) {
      req.files.forEach((file) => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    return res.status(500).json({
      status: false,
      message: "Failed to send bulk messages",
      error: error.message,
    });
  }
};

// ✅ Send Bulk Message Schedule
export const sendBulkSchedule = async (req, res) => {
  try {
    const { deviceId, message, timer, schedule } = req.body;
    let numbers = req.body.numbers || [];
    let captions = req.body.captions || [];
    const attachments = req.files;
    const userId = req.user.userId;

    // Validate inputs
    if (!deviceId || !numbers.length) {
      if (attachments?.length) {
        attachments.forEach((file) => fs.unlinkSync(file.path));
      }
      return res.status(400).json({
        status: false,
        message: "Device ID and numbers are required",
      });
    }
    const check = await canSendMessage(req, userId);
    if (!check.allowed) {
      return res.status(403).json({ success: false, message: check.reason });
    }

    // Process arrays
    numbers = JSON.parse(numbers);
    numbers = Array.isArray(numbers) ? numbers : [numbers];
    captions = Array.isArray(captions) ? captions : [captions];

    // Validate schedule if provided
    let delay = 0;
    let scheduledAt = null;

    if (schedule) {
      if (!moment(schedule, moment.ISO_8601, true).isValid()) {
        return res.status(400).json({
          status: false,
          message:
            "Invalid schedule format. Use ISO 8601 format (e.g., '2023-12-31T23:59:59Z')",
        });
      }

      if (moment(schedule).isBefore(moment())) {
        return res.status(400).json({
          status: false,
          message: "Schedule time must be in the future",
        });
      }

      delay = moment(schedule).diff(moment(), "milliseconds");
      scheduledAt = new Date(schedule);
    }

    // Prepare attachments
    const tempAttachments = (attachments || []).map((file) => ({
      path: file.path,
      mimetype: file.mimetype,
      originalname: file.originalname,
    }));

    // Job options
    const jobOptions = {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
      removeOnFail: true,
    };

    // Add delay if scheduled
    if (schedule) {
      jobOptions.delay = delay;
    }

    try {
      await messageQueue.add(
        "message-queue",
        {
          userId,
          deviceId,
          enableCode: req.user.enableCode,
          numbers,
          req:req.user,
          message: htmlToWhatsapp(message),
          captions,
          attachments: tempAttachments || [],
          type: "bulk",
          timer: timer || 1,
          isScheduled: !!schedule,
          scheduledAt,
        },
        jobOptions
      );

      return res.json({
        status: true,
        message: schedule
          ? `Bulk message scheduled for ${schedule}`
          : "Bulk message queued",
        data: {
          schedule: schedule || null,
          count: numbers.length,
        },
      });
    } catch (error) {
      console.error("❌ Failed to add bulk job:", error);

      // Cleanup attachments on queue error
      tempAttachments.forEach((file) => {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      });

      return res.status(500).json({
        status: false,
        message: "Failed to queue bulk message",
        error: error.message,
      });
    }
  } catch (err) {
    console.error("❌ Error in sendBulkSchedule:", err);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: err.message,
    });
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

//📜 Whatsapp api's endpoints started

// ✅ Send Message API
export const sendMessageApi = async (req, res) => {
  try {
    const { apikey, to: numberRaw, message: rawMessage } = req.query;
    const userId = req?.userId;
    const deviceId = req?.deviceId;

    if (!userId)
      return res.status(401).json({ status: false, message: "Invalid user" });
    if (!apikey || !numberRaw || !rawMessage || !deviceId) {
      return res
        .status(400)
        .json({ status: false, message: "Missing required fields" });
    }

    const check = await canSendMessage(req, userId);
    if (!check.allowed) {
      return res.status(403).json({ success: false, message: check.reason });
    }

    const number = numberRaw;
    const message = rawMessage;
    req.user = {}
    try {
      await messageQueue.add(
        "message-queue",
        {
          api: true,
          userId,
          deviceId,
          enableCode: req.user.enableCode,
          number,
          req:req.user,
          message: message,
          captions: [],
          attachments: [],
        },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: true,
          removeOnFail: true,
        }
      );
    
      console.log("📤 Job added to queue ✅");
      return res.status(200).json({
        status: true,
        message: "Message Sent Succesfully",
        data: null,
      });
    } catch (error) {
      console.error("❌ Failed to add job to queue:", error.message);
      return res.status(500).json({
        status: false,
        message: "Failed to queue message",
        error: error.message,
      });
    }
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

    await session.sock.sendMessage(jid, { text: message });

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

//✅  Monitor sessions
export function startSessionMonitoring() {
  setInterval(() => {
    const sessionCount = Object.keys(sessions).length;
    logger.info(`Active sessions: ${sessionCount}`);

    // Check each session's health
    for (const clientId in sessions) {
      const session = sessions[clientId];
      if (!session || !session.sock) continue;

      // Check if the socket is still alive
      const isConnected = session.sock.user != null;
      logger.debug(
        `[${clientId}] Connection status: ${
          isConnected ? "connected" : "disconnected"
        }`
      );

      // If disconnected but not yet recognized, trigger reconnection
      if (!isConnected && !session.reconnectAttempts) {
        logger.warn(
          `[${clientId}] Detected zombie session, triggering reconnect`
        );
        messageQueue.add("reconnect", { clientId }, { delay: 1000 });
      }
    }

    // Log memory usage
    const memUsage = process.memoryUsage();
    logger.info(
      `Memory usage: RSS ${Math.round(
        memUsage.rss / 1024 / 1024
      )} MB, Heap ${Math.round(memUsage.heapUsed / 1024 / 1024)}/${Math.round(
        memUsage.heapTotal / 1024 / 1024
      )} MB`
    );
  }, 60000); // Check every minute
}
