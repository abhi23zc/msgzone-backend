// redis.js
import dotenv from 'dotenv';
dotenv.config();
import IORedis from 'ioredis';

const redisClient = new IORedis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,  
  // password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, 
}
);

redisClient.on('error', (err) => {
  console.error('❌ Redis Client Error:', err);
});

export default redisClient;
