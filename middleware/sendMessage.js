import { User } from "../models/user.Schema.js";

export const canSendMessage = async (req, userId) => {
  const user = await User.findById(userId).populate("subscriptions.plan");
  if (!user) {
    return { allowed: false, reason: "User not found" };
  }

  req.enableCode = user?.enableCode;

  // Find active subscription or next available subscription
  let activeSub = user.subscriptions?.find((sub) => sub.status === "active");
  const now = Date.now();

  // Check if active subscription is valid and not expired
  if (activeSub) {
    const isExpired = activeSub.endDate && now > activeSub.endDate.getTime();
    const isValid = activeSub.startDate && activeSub.endDate && activeSub.plan;
    
    if (isExpired || !isValid ) {
      // Deactivate current subscription
      activeSub.status = "expired";
      
      // Find next valid subscription that hasn't started yet
      const nextSub = user.subscriptions?.find(
        (sub) => sub.status === "inactive" && !sub.startDate && sub.plan
      );

      if (nextSub) {
        nextSub.status = "active";
        nextSub.startDate = new Date();
        nextSub.endDate = new Date(
          Date.now() + nextSub.plan.durationDays * 24 * 60 * 60 * 1000
        );
        activeSub = nextSub;
        await user.save();
      } else {
        activeSub = null;
      }
    }
  }

  // If no active subscription, try to activate an available one
  if (!activeSub) {
    const availableSub = user.subscriptions?.find(
      (sub) => 
        sub.status === "inactive" && 
        !sub.startDate && 
        !sub.endDate && 
        sub.plan
    );

    if (availableSub) {
      availableSub.status = "active";
      availableSub.startDate = new Date();
      availableSub.endDate = new Date(
        Date.now() + availableSub.plan.durationDays * 24 * 60 * 60 * 1000
      );
      activeSub = availableSub;
      await user.save();
    }
  }

  if (!activeSub?.plan) {
    return { allowed: false, reason: "No active plan" };
  }

  // Verify subscription validity
  if (!activeSub.startDate || !activeSub.endDate) {
    return { allowed: false, reason: "Invalid subscription dates" };
  }

  const type = activeSub.plan.type;
  const limit = activeSub.plan.messageLimit || 0;
  const used = activeSub.usedMessages || 0;

  if (now > activeSub.endDate.getTime()) {
    return { allowed: false, reason: "Plan expired" };
  }

  if (type === "limited" && used >= limit) {
    activeSub.status = "expired";
    activeSub.isActive = false;
    await user.save()
    return { allowed: false, reason: "Message quota exceeded" };
  }

  return { allowed: true };
};

export const incrementMessageCount = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return;

  const activeSub = user.subscriptions?.find(
    (sub) => 
      sub.status === "active" && 
      sub.startDate && 
      sub.endDate && 
      Date.now() <= sub.endDate.getTime()
  );

  if (activeSub) {
    activeSub.usedMessages = (activeSub.usedMessages || 0) + 1;
    await user.save();
  }
};
