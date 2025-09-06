import { Queue } from 'bullmq';
import redisClient from './redis.js';

export const emailQueue = new Queue('email-queue', {
  connection: redisClient,
  defaultJobOptions: {
    removeOnComplete: 10, // Keep only 10 completed jobs
    removeOnFail: 50, // Keep 50 failed jobs for debugging
    attempts: 3, // Retry failed jobs 3 times
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 second delay
    },
  },
});

// Log queue initialization
console.log("📬 Email queue initialized and ready to accept jobs");
