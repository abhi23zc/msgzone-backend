import { User } from "../models/user.Schema.js";
import redis from "../utils/redis.js";

export const canSendMessage = async (userId) => {
    const key = `sub:${userId}`;
    let data = await redis.hgetall(key);
    
    // ❌If Redis caching fails
    if (!data || !data.planId) {
        console.log("Redis Cache failed")
        const user = await User.findById(userId).populate("subscription.plan");
        const sub = user?.subscription;

        if (!sub?.plan) return { allowed: false, reason: "No plan" };

        const now = new Date();
        const end = sub.endDate;
        const type = sub.plan.type;
        const limit = sub.plan.messageLimit || 0;
        const used = sub.usedMessages || 0;

        await redis.hmset(key, {
            planId: sub.plan._id.toString(),
            type,
            limit,
            used,
            endDate: end.getTime(),
        });
          await redis.expireat(key, Math.floor(end.getTime() / 1000));

        data = {
            type,
            limit: limit.toString(),
            used: used.toString(),
            endDate: end.getTime().toString(),
        };
    }

    // ✅ Check valid or not
    const now = Date.now();
    const endDate = parseInt(data.endDate);
    const used = parseInt(data.used);
    const limit = parseInt(data.limit || "0");

    if (now > endDate) {
        return { allowed: false, reason: "Plan expired" };
    }

    if (data.type === "limited" && used >= limit) {
        return { allowed: false, reason: "Message quota exceeded" };
    }

    return { allowed: true };
};
export const incrementMessageCountRedis = async (userId) => {
    await redis.hincrby(`sub:${userId}`, "used", 1);
};