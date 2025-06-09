import { Queue } from 'bullmq';
import redisClient from './redis.js';

export const emailQueue = new Queue('email-queue', {
  connection: redisClient
});
