import { Worker } from "bullmq";
import fs from "fs";
import { unlink } from "fs/promises";
import os from "os";
import dotenv from "dotenv";
import logger from "../utils/logger.js";
import redisClient from "./redis.js";
import { MessageLog } from "../models/_message.log.schema.js";
import {
  getSession,
  createClient,
} from "../controller/_whatsapp.controller.js";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { messageQueue } from "./messageQueue.js";

dotenv.config();

const rateLimiters = new Map();
const MAX_FILE_SIZE_MB = 10;

async function processMessageJob(job) {
  const {
    api,
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
  const scheduledAt = isScheduled ? new Date(job.timestamp + job.delay) : null;

  let session = getSession(clientId);

  // Reconnect logic before starting
  if (!session?.sock?.user) {
    logger.warn(`[${clientId}] Session not found or not authenticated`);

    await messageQueue.add(
      "reconnect",
      { clientId },
      {
        delay: 3000,
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: true,
        removeOnFail: true,
      }
    );

    throw new Error(`[${clientId}] Session not authenticated - reconnect enqueued`);
  }

  const limiterKey = `${userId}-${deviceId}`;
  if (!rateLimiters.has(limiterKey)) {
    rateLimiters.set(
      limiterKey,
      new RateLimiterMemory({ points: 1, duration: 2 })
    );
  }

  const rateLimiter = rateLimiters.get(limiterKey);
  const resolvedNumbers = type === "bulk" ? numbers : [number];

  for (let idx = 0; idx < resolvedNumbers.length; idx++) {
    const currentNumber = resolvedNumbers[idx];
    const jid = currentNumber.includes("@s.whatsapp.net")
      ? currentNumber
      : `${currentNumber}@s.whatsapp.net`;

    try {
      // RATE LIMIT HANDLING
      let consumed = false;
      while (!consumed) {
        try {
          await rateLimiter.consume(limiterKey);
          consumed = true;
        } catch (rateError) {
          const waitTime = rateError.msBeforeNext || 2000;
          logger.warn(`[RateLimit] Waiting ${waitTime}ms for ${deviceId}`);
          await new Promise((res) => setTimeout(res, waitTime));
        }
      }

      try {
        const [result] = await session.sock.onWhatsApp(jid);
        if (!result?.exists) {
          await logMessage(api, userId, deviceId, currentNumber, message, "error", "Number does not exist", type, isScheduled, scheduledAt, []);
          continue;
        }
      } catch (err) {
        logger.warn(`[${clientId}] Socket dropped, enqueueing reconnect`);
        await messageQueue.add("reconnect", { clientId }, {
          delay: 3000,
          attempts: 3,
          backoff: { type: "exponential", delay: 3000 },
          removeOnComplete: true,
          removeOnFail: true,
        });
        throw new Error("Socket dropped - reconnect triggered");
      }

      // ✅ SEND TEXT
      if (message?.trim()) {
        await session.sock.sendMessage(jid, { text: message });
      }

      // ✅ SEND ATTACHMENTS
      for (let i = 0; i < attachments.length; i++) {
        const file = attachments[i];
        if (!file || !file.path || !file.mimetype || !file.originalname) {
          logger.warn(`[${clientId}] Invalid attachment: ${JSON.stringify(file)}`);
          continue;
        }

        const fileSizeInMB = fs.statSync(file.path).size / (1024 * 1024);
        if (fileSizeInMB > MAX_FILE_SIZE_MB) {
          logger.warn(`[${clientId}] Skipping large file: ${file.originalname}`);
          continue;
        }

        const buffer = fs.readFileSync(file.path);
        const caption = Array.isArray(captions) ? captions[i] || "" : "";
        const mime = file.mimetype;
        const isImage = mime.startsWith("image/");
        const isVideo = mime.startsWith("video/");
        const isAudio = mime.startsWith("audio/");
        const typeKey = isImage ? "image" : isVideo ? "video" : isAudio ? "audio" : "document";

        try {
          await session.sock.sendMessage(jid, {
            [typeKey]: buffer,
            mimetype: mime,
            fileName: file.originalname,
            caption,
          });
        } catch (err) {
          logger.error(`[${clientId}] Failed to send attachment: ${err.message}`);
        }
      }

      await logMessage(api, userId, deviceId, currentNumber, message, "delivered", "", type, isScheduled, scheduledAt, attachments);

      if (type === "bulk") {
        await new Promise((res) => setTimeout(res, Number(timer) * 1000));
      }
    } catch (error) {
      logger.error(`[${jid}] Send failed: ${error.message}`);
      await logMessage(api, userId, deviceId, currentNumber, message, "error", error.message, type, isScheduled, scheduledAt, attachments);
    }
  }

  await cleanupAttachments(attachments);
}

async function logMessage(api, userId, deviceId, to, message, status, errorMessage, type, isScheduled, scheduledAt, attachments = []) {
  const mappedAttachments = attachments.map((file) => {
    const mime = file.mimetype || "";
    let fileType = "document";
    if (mime.startsWith("image/")) fileType = "image";
    else if (mime.startsWith("video/")) fileType = "video";
    else if (mime.startsWith("audio/")) fileType = "audio";

    return {
      type: fileType,
      url: file.path,
      name: file.originalname,
    };
  });

  await MessageLog.create({
    sendThrough: api ? "api" : "app",
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
      if (file?.path && fs.existsSync(file.path)) {
        await unlink(file.path);
        logger.info(`Deleted attachment: ${file.path}`);
      }
    } catch (err) {
      logger.error(`Failed to delete ${file?.path}: ${err.message}`);
    }
  }
}

export const worker = new Worker(
  "message-queue",
  async (job) => {
    const { clientId } = job.data;

    if (job.name === "reconnect" && clientId) {
      logger.info(`[Worker] Reconnecting session for ${clientId}`);
      try {
        await createClient(clientId);
        logger.info(`[Worker] Successfully reconnected ${clientId}`);
      } catch (error) {
        logger.error(`[Worker] Failed to reconnect ${clientId}: ${error.message}`);
        throw error;
      }
      return;
    }

    await processMessageJob(job);
  },
  {
    connection: redisClient,
    concurrency: Math.max(os.cpus().length * 2, 4),
    limiter: {
      max: 50,
      duration: 1000,
    },
    stalledInterval: 30000,
    lockDuration: 60000,
  }
);

worker.on("error", (err) => {
  logger.error(`Worker error: ${err.message}`);
});

worker.on("stalled", (jobId) => {
  logger.warn(`Job ${jobId} stalled`);
});
