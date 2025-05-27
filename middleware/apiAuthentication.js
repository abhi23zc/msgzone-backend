import dotenv from 'dotenv';
import { ApiKey } from '../models/api.key.Schema.js';
import redis from "../utils/redis.js";
dotenv.config()

// 👀 check api authentication
export const isApiAuthenticated = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apikey;

  if (!apiKey) {
    return res.status(401).json({ status:false, data:null, message: "API key missing" });
  }

  // const hashed = hashApiKey(apiKey);
  const hashed = (apiKey);
  const redisKey = `apikey:${hashed}`;
  
  try {
    // 🔍 1. Try Redis first
    const cached = await redis.get(redisKey);
    if (cached) {
      // console.log("🔍 Cache hit", redisKey);
      const parsed = JSON.parse(cached);
      req.deviceId = parsed.deviceId;
      req.userId = parsed.userId;
      return next();
    }

    // 🔍 2. Fallback to DB
    const keyDoc = await ApiKey.findOne({ apiKey: hashed });
    if (!keyDoc) {
      return res.status(401).json({ status:false, data:null, message: "Invalid API key" });
    }

    // 💾 3. Cache it in Redis for future
    await redis.set(redisKey, JSON.stringify({
      userId: keyDoc.userId,
      deviceId: keyDoc.deviceId
    }), 'EX', 86400); // 24 hours

    req.deviceId = keyDoc.deviceId;
    req.userId = keyDoc.userId;
    next();
  } catch (err) {
    console.error("Redis error", err);
    return res.status(500).json({status:false, data:null, message: "Internal error" });
  }
};



