import { Worker } from "bullmq";
import fs from "fs";
import { unlink } from "fs/promises";
import { MessageLog } from "../models/_message.log.schema.js";
import os from "os";
import logger from "../utils/logger.js";
import dotenv from "dotenv";
import redisClient from "./redis.js";
import { getSession, createClient } from "../controller/_whatsapp.controller.js";
import { RateLimiterMemory } from "rate-limiter-flexible";

dotenv.config();

const rateLimiters = new Map();

const processMessageJob = async (job) => {
  const {
    userId,
    deviceId,
    type = "single",
    numbers = [],
    number,
    message,
    captions = [],
    attachments = [],
    timer = 1,
    isScheduled = false,
  } = job.data;

  const clientId = `${userId}-${deviceId}`;
  let session = getSession(clientId);
  const scheduledAt = isScheduled ? new Date(job.timestamp + job.delay) : null;

  try {
    logger.info(`Processing ${isScheduled ? "scheduled " : ""}${type} job ${job.id} for ${clientId}`);

    if (!session?.user) {
      await createClient(clientId);
      session = getSession(clientId);
      if (!session?.user) throw new Error("Client unavailable after reconnect");
    }

    if (!rateLimiters.has(deviceId)) {
      rateLimiters.set(deviceId, new RateLimiterMemory({
        points: 15,
        duration: 1,
      }));
    }
    const rateLimiter = rateLimiters.get(deviceId);

    const resolvedNumbers = type === "bulk" ? numbers : [number];

    for (let idx = 0; idx < resolvedNumbers.length; idx++) {
      const currentNumber = resolvedNumbers[idx];
      const jid = currentNumber.includes("@s.whatsapp.net")
        ? currentNumber
        : `${currentNumber}@s.whatsapp.net`;

      try {
        await rateLimiter.consume(jid);

        const [result] = await session.sock.onWhatsApp(jid);
        if (!result?.exists) {
          await logMessage(userId, deviceId, currentNumber, message, "error", "Number does not exist", type, isScheduled, scheduledAt, []);
          continue;
        }

        if (message?.trim()) {
          await session.sock.sendMessage(jid, { text: message });
        }

        for (let i = 0; i < attachments.length; i++) {
          const file = attachments[i];
          const caption = Array.isArray(captions) ? captions[i] || "" : "";
          const isImage = file.mimetype.startsWith("image/");

          const stream = fs.createReadStream(file.path);

          await session.sock.sendMessage(jid, {
            [isImage ? "image" : "document"]: {
              url: file.path,
              stream: stream,
            },
            caption,
            mimetype: file.mimetype,
            fileName: file.originalname,
          });
        }

        await logMessage(userId, deviceId, currentNumber, message, "delivered", "", type, isScheduled, scheduledAt, attachments);

        if (type === "bulk") {
          await new Promise((res) => setTimeout(res, Number(timer) * 1000));
        }
      } catch (error) {
        logger.error(`[${jid}] Send failed: ${error.message}`);
        await logMessage(userId, deviceId, currentNumber, message, "error", error.message, type, isScheduled, scheduledAt, attachments);
      }
    }
  } catch (error) {
    logger.error(`Job ${job.id} failed: ${error.message}`);
    throw error;
  } finally {
    await cleanupAttachments(attachments);
  }
};

async function logMessage(userId, deviceId, to, message, status, errorMessage, type, isScheduled, scheduledAt, attachments = []) {
  const mappedAttachments = attachments.map((file) => {
    const mime = file.mimetype || "";
    let fileType = "document";

    if (mime.startsWith("image/")) fileType = "image";
    else if (mime.startsWith("video/")) fileType = "video";
    else if (mime.startsWith("audio/")) fileType = "audio";

    return {
      type: fileType,
      url: file.path, // change to public URL if needed
      name: file.originalname,
    };
  });

  await MessageLog.create({
    userId,
    sendFrom: deviceId,
    sendTo: to,
    text: message,
    attachments: mappedAttachments,
    status,
    errorMessage,
    type,
    isScheduled,
    scheduledAt,
    sentAt: new Date(),
  });
}

async function cleanupAttachments(attachments) {
  for (const file of attachments) {
    try {
      if (fs.existsSync(file.path)) {
        await unlink(file.path);
        logger.info(`Deleted attachment: ${file.path}`);
      }
    } catch (err) {
      logger.error(`Failed to delete ${file.path}: ${err.message}`);
    }
  }
}

export const worker = new Worker("message-queue", processMessageJob, {
  connection: redisClient,
  concurrency: Math.max(os.cpus().length * 2, 4),
});
