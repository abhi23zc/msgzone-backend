import { User } from "../models/user.Schema.js";


export const checkDevice = async (userId, newDeviceId) => {
    const user = await User.findById(userId).populate("subscription.plan");
    if (!user) return { allowed: false, reason: "User not found" };

    const plan = user.subscription?.plan;
    if (!plan) return { allowed: false, reason: "No plan assigned" };

    const currentDeviceIds = user.devices.map((d) => d.deviceId);
    if (currentDeviceIds.includes(newDeviceId)) {
        return { allowed: true }; // already connected device
    }
    
    const deviceLimit = plan.deviceLimit || 1;
   
    if (currentDeviceIds.length >= deviceLimit) {
        return { allowed: false, reason: `Device limit reached` };
    }

    return { allowed: true };
};
