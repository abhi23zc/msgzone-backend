import dotenv from 'dotenv';
dotenv.config()
import { createClient } from 'redis';

const redisClient = createClient({
  // username: 'default',
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  },
});

redisClient.on('error', (err) => {
  console.error('❌ Redis Client Error:', err);
});

export default redisClient;
