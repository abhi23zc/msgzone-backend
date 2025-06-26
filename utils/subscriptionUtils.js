import { User } from "../models/user.Schema.js";
import redisClient from "./redis.js";

export const checkAndActivateNextPlan = async (userId) => {
  const user = await User.findById(userId).populate("subscriptions.plan");
  if (!user || !user.subscriptions.length) return;

  const now = new Date();
  let changed = false;

  // 🔍 1. Deactivate current plan if needed
  const current = user.subscriptions.find((sub) => sub.isActive);
  if (current) {
    const { plan, endDate, usedMessages, deviceIds } = current;

    const expired = endDate && now > endDate;
    const msgLimitReached =
      plan.type === "limited" && usedMessages >= plan.messageLimit;
    const deviceLimitReached =
      plan.deviceLimit && deviceIds.length >= plan.deviceLimit;

    if (expired || msgLimitReached || deviceLimitReached) {
      current.isActive = false;
      changed = true;
    } else {
      return; // ✅ Still valid, nothing to do
    }
  }
  console.log("Plan expired")
  // ✅ 2. Activate next queued plan (if any)
  const next = user.subscriptions.find((sub) => !sub.isActive);
  if (next) {
    const start = new Date();
    const end = new Date(start.getTime() + next.plan.durationDays * 24 * 60 * 60 * 1000);
    next.startDate = start;
    next.endDate = end;
    next.usedMessages = 0;
    next.deviceIds = [];
    next.isActive = true;
    changed = true;
  }

  if (changed) {
    await redisClient.del(`sub:${userId}`);
    await user.save();
  }
};
