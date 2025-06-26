import { User } from "../models/user.Schema.js";

export const canSendMessage = async (userId) => {
  const user = await User.findById(userId).populate("subscription.plan");
  const sub = user?.subscription;

  if (!sub?.plan) return { allowed: false, reason: "No plan" };

  const now = Date.now();
  const endDate = sub.endDate.getTime();
  const type = sub.plan.type;
  const limit = sub.plan.messageLimit || 0;
  const used = sub.usedMessages || 0;

  if (now > endDate) {
    return { allowed: false, reason: "Plan expired" };
  }

  if (type === "limited" && used >= limit) {
    return { allowed: false, reason: "Message quota exceeded" };
  }

  return { allowed: true };
};

export const incrementMessageCount = async (userId) => {
  const user = await User.findById(userId);
  if (user?.subscription) {
    user.subscription.usedMessages = (user.subscription.usedMessages || 0) + 1;
    await user.save();
  }
};
