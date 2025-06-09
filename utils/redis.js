// redis.js
import dotenv from 'dotenv';
dotenv.config();
import IORedis from 'ioredis';

const redisClient = new IORedis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,  
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Limit retries to prevent infinite loops
  connectTimeout: 10000, // 10 seconds
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  enableReadyCheck: true,
  enableOfflineQueue: true,
});

redisClient.on('error', (err) => {
  console.error('❌ Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('✅ Redis Client Connected');
});

redisClient.on('reconnecting', () => {
  console.log('🔄 Redis Client Reconnecting...');
});

export default redisClient;
