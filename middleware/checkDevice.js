import { User } from "../models/user.Schema.js";

export const checkDevice = async (userId, newDeviceId) => {
  const user = await User.findById(userId).populate("subscriptions.plan");
  if (!user) return { allowed: false, reason: "User not found" };

  // Find active subscription or check for expired subscription that can be activated
  let activeSubscription = user.subscriptions?.find(
    (sub) =>
      sub.isActive && (!sub.endDate || new Date(sub.endDate) > new Date())
  );

  if (!activeSubscription) {
    // Check for next valid subscription if current one expired
    const now = new Date();

    // Find next subscription that has a plan but isn't active yet
    const nextValidSub = user.subscriptions?.find(
      (sub) => !sub.isActive && sub.plan
    );

    if (nextValidSub) {
      // Set start date to current date
      nextValidSub.startDate = now;

      // Calculate end date based on plan duration
      const durationDays = nextValidSub.plan.durationDays;
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + durationDays);
      nextValidSub.endDate = endDate;

      // Activate the next valid subscription
      nextValidSub.isActive = true;
      await user.save();
      activeSubscription = nextValidSub;
    }
  }

  if (!activeSubscription?.plan) {
    return { allowed: false, reason: "No active plan found" };
  }

  const currentDeviceIds = user.devices.map((d) => d.deviceId);
  if (currentDeviceIds.includes(newDeviceId)) {
    return { allowed: true }; // already connected device
  }

  const deviceLimit = activeSubscription.plan.deviceLimit || 1;
  if (currentDeviceIds.length >= deviceLimit) {
    return { allowed: false, reason: `Device limit reached` };
  }

  return { allowed: true };
};
