import { User } from "../models/user.Schema.js";

export const checkDevice = async (userId, newDeviceId) => {
  const user = await User.findById(userId).populate("subscriptions.plan");
  if (!user) return { allowed: false, reason: "User not found" };

  // Find active subscription
  let activeSubscription = user.subscriptions?.find((sub) => sub.status === "active");
  const now = Date.now();

  if (activeSubscription) {
    // Check if subscription has expired
    if (activeSubscription.endDate && new Date(activeSubscription.endDate).getTime() < now) {
      // Find next subscription that has a plan but isn't active yet
      const nextValidSub = user.subscriptions?.find(
        (sub) => sub.status !== "active" && sub.plan
      );

      if (nextValidSub) {
        // Set start date to current date
        nextValidSub.startDate = new Date(now);

        // Calculate end date based on plan duration
        const durationDays = nextValidSub.plan.durationDays;
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + durationDays);
        nextValidSub.endDate = endDate;

        // Activate the next valid subscription
        nextValidSub.status = "active";
        await user.save();
        activeSubscription = nextValidSub;
      } else {
        activeSubscription = null;
      }
    }
  }

  if (!activeSubscription?.plan) {
    return { allowed: false, reason: "No active plan found" };
  }

  const currentDeviceIds = user.devices.map((d) => d.deviceId);
  if (currentDeviceIds.includes(newDeviceId)) {
    return { allowed: true }; // already connected device
  }

  const deviceLimit = activeSubscription.plan.deviceLimit || 0;
  console.log(currentDeviceIds.length, deviceLimit);
  if (currentDeviceIds.length >= deviceLimit) {
    return { allowed: false, reason: `Device limit reached` };
  }

  return { allowed: true };
};
