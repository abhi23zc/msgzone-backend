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
  let session = getSession(clientId);
  const scheduledAt = isScheduled ? new Date(job.timestamp + job.delay) : null;

  try {
    logger.info(
      `Processing ${isScheduled ? "scheduled " : ""}${type} job ${
        job.id
      } for ${clientId}`
    );

    if (!session?.sock?.user) {
      logger.warn(
        `[${clientId}] Session not authenticated. Enqueueing reconnect job`
      );

      await messageQueue.add(
        "reconnect",
        { clientId },
        {
          delay: 5000,
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: true,
          removeOnFail: true,
        }
      );

      throw new Error("Not authenticated — Enqueued reconnect");
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
        // ✅ Retry until rate limit allows
        let consumed = false;
        while (!consumed) {
          try {
            await rateLimiter.consume(limiterKey);

            consumed = true;
          } catch (rateError) {
            const waitTime = rateError.msBeforeNext || 2000;
            logger.warn(
              `[RateLimit] Waiting ${waitTime}ms before retrying for ${deviceId}`
            );
            await new Promise((res) => setTimeout(res, waitTime));
          }
        }

        try {
          const [result] = await session.sock.onWhatsApp(jid);
          if (!result?.exists) {
            await logMessage(
              api,
              userId,
              deviceId,
              currentNumber,
              message,
              "error",
              "Number does not exist",
              type,
              isScheduled,
              scheduledAt,
              []
            );
            continue;
          }
        } catch (err) {
          logger.warn(`[${clientId}] Socket dropped mid-job`);
          await messageQueue.add("reconnect", { clientId });
          throw new Error("Reconnecting due to socket drop");
        }

        if (message?.trim()) {
          await session.sock.sendMessage(jid, { text: message });
        }

        // for (let i = 0; i < attachments.length; i++) {
        //   const file = attachments[i];
        //   const caption = Array.isArray(captions) ? captions[i] || "" : "";
        //   const isImage = file.mimetype.startsWith("image/");
        //   const fileSizeInMB = fs.statSync(file.path).size / (1024 * 1024);

        //   if (fileSizeInMB > MAX_FILE_SIZE_MB) {
        //     throw new Error(`Attachment exceeds ${MAX_FILE_SIZE_MB}MB`);
        //   }

        //   const stream = fs.createReadStream(file.path);

        //   await pipeline(
        //     stream,
        //     session.sock.sendMessage(jid, {
        //       [isImage ? "image" : "document"]: { stream },
        //       caption,
        //       mimetype: file.mimetype,
        //       fileName: file.originalname,
        //     })
        //   );

        //   stream.destroy();
        // }

        for (let i = 0; i < attachments.length; i++) {
          const file = attachments[i];
          if (!file || !file.path || !file.mimetype || !file.originalname) {
            logger.warn(
              `[${clientId}] Skipping invalid attachment: ${JSON.stringify(
                file
              )}`
            );
            continue;
          }

          const fileSizeInMB = fs.statSync(file.path).size / (1024 * 1024);
          if (fileSizeInMB > MAX_FILE_SIZE_MB) {
            logger.warn(
              `[${clientId}] Skipping large file: ${file.originalname}`
            );
            continue;
          }

          const stream = fs.createReadStream(file.path);
          const caption = Array.isArray(captions) ? captions[i] || "" : "";
          const isImage = file.mimetype.startsWith("image/");
          const isVideo = file.mimetype.startsWith("video/");
          const isAudio = file.mimetype.startsWith("audio/");

          let typeKey = "document";
          if (isImage) typeKey = "image";
          else if (isVideo) typeKey = "video";
          else if (isAudio) typeKey = "audio";

          try {
            // Read file into buffer instead of passing stream directly
            const buffer = fs.readFileSync(file.path);
            
            await session.sock.sendMessage(jid, {
              [typeKey]: buffer,
              mimetype: file.mimetype,
              fileName: file.originalname,
              caption: caption,
            });
          } catch (err) {
            logger.error(
              `[${clientId}] Failed to send attachment: ${err.message}`
            );
          }
        }

        await logMessage(
          api,
          userId,
          deviceId,
          currentNumber,
          message,
          "delivered",
          "",
          type,
          isScheduled,
          scheduledAt,
          attachments
        );

        if (type === "bulk") {
          await new Promise((res) => setTimeout(res, Number(timer) * 1000));
        }
      } catch (error) {
        logger.error(`[${jid}] Send failed: ${error.message}`);
        await logMessage(
          api,
          userId,
          deviceId,
          currentNumber,
          message,
          "error",
          error.message,
          type,
          isScheduled,
          scheduledAt,
          attachments
        );
      }
    }
  } catch (error) {
    logger.error(`Job ${job.id} failed: ${error.message}`);
    throw error;
  } finally {
    await cleanupAttachments(attachments);
  }
}

async function logMessage(
  api,
  userId,
  deviceId,
  to,
  message,
  status,
  errorMessage,
  type,
  isScheduled,
  scheduledAt,
  attachments = []
) {
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
        const existingSession = getSession(clientId);
        if (existingSession?.sock?.user) {
          logger.info(
            `[Worker] Session ${clientId} already connected, skipping reconnect`
          );
          return;
        }

        await createClient(clientId);
        logger.info(`[Worker] Successfully reconnected ${clientId}`);
      } catch (error) {
        logger.error(
          `[Worker] Failed to reconnect ${clientId}: ${error.message}`
        );
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
