import { User } from "../models/user.Schema.js";

export const canSendMessage = async (userId) => {
  const user = await User.findById(userId).populate("subscriptions.plan");

  if (!user) {
    return { allowed: false, reason: "User not found" };
  }

  // Find active subscription or next available subscription
  let activeSub = user.subscriptions?.find((sub) => sub.isActive);
  const now = Date.now();

  // If active subscription is expired, try to activate next available subscription
  if (activeSub && activeSub.endDate && now > activeSub.endDate.getTime()) {
    // Deactivate current subscription
    activeSub.isActive = false;

    // Find next valid subscription that hasn't started yet
    const nextSub = user.subscriptions?.find(
      (sub) => !sub.isActive && !sub.startDate
    );

    if (nextSub) {
      nextSub.isActive = true;
      nextSub.startDate = new Date();
      nextSub.endDate = new Date(
        Date.now() + nextSub.plan.durationDays * 24 * 60 * 60 * 1000
      );
      activeSub = nextSub;
      await user.save();
    }
  }

  // If no active subscription, try to activate an available one
  if (!activeSub) {
    const availableSub = user.subscriptions?.find(
      (sub) => !sub.isActive && !sub.startDate && !sub.endDate
    );

    if (availableSub) {
      availableSub.isActive = true;
      availableSub.startDate = new Date();
      availableSub.endDate = new Date(
        Date.now() + availableSub.plan.durationDays * 24 * 60 * 60 * 1000
      );
      activeSub = availableSub;
      await user.save();
    }
  }

  if (!activeSub?.plan) return { allowed: false, reason: "No active plan" };

  const type = activeSub.plan.type;
  const limit = activeSub.plan.messageLimit || 0;
  const used = activeSub.usedMessages || 0;

  if (activeSub.endDate && now > activeSub.endDate.getTime()) {
    return { allowed: false, reason: "Plan expired" };
  }

  if (type === "limited" && used >= limit) {
    return { allowed: false, reason: "Message quota exceeded" };
  }

  return { allowed: true };
};

export const incrementMessageCount = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return;

  const activeSub = user.subscriptions?.find((sub) => sub.isActive);

  if (activeSub) {
    activeSub.usedMessages = (activeSub.usedMessages || 0) + 1;
    await user.save();
  }
};
