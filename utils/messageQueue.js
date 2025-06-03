import { Queue } from 'bullmq';
import redisClient from './redis.js';

export const messageQueue = new Queue('message-queue', {
  connection: redisClient,
  
});
