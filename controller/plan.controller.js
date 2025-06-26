import { User } from "../models/user.Schema.js";

export const getUserActivePlan = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not found", data: null });
    }

    const user = await User.findById(userId)
      .populate("subscriptions.plan")
      .select("subscriptions");

    if (!user?.subscriptions?.length) {
      return res.status(404).json({ success: false, message: "No subscriptions found", data: null });
    }

    const activeSub = user.subscriptions.find(sub => sub.isActive);
    if (!activeSub?.plan) {
      return res.status(404).json({ success: false, message: "No active subscription plan found", data: null });
    }

    // 🟢 Check active is active or inactive by admin
    const { plan } = activeSub;
    if (plan.status !== "active") {
      return res.status(400).json({ success: false, message: "Subscription plan is inactive", data: null });
    }

    const planData = {
      id: plan._id,
      name: plan.name,
      type: plan.type,
      price: plan.price,
      currency: plan.currency,
      durationDays: plan.durationDays,
      messageLimit: plan.type === "unlimited" ? null : plan.messageLimit,
      deviceLimit: plan.deviceLimit,
      status: plan.status,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt
    };

    const responseData = {
      plan: planData,
      startDate: activeSub.startDate,
      endDate: activeSub.endDate,
      usedMessages: activeSub.usedMessages,
      deviceIds: activeSub.deviceIds || []
    };

    return res.status(200).json({
      success: true,
      message: "Active subscription plan fetched successfully",
      data: responseData
    });

  } catch (error) {
    console.error("Error fetching user active plan:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error", 
      data: null 
    });
  }
};
export const getUserSubscriptions = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not found", data: null });
    }

    const user = await User.findById(userId)
      .populate("subscriptions.plan")
      .select("subscriptions");

    if (!user?.subscriptions?.length) {
      return res.status(404).json({ success: false, message: "No subscriptions found", data: null });
    }

    const subscriptionsData = user.subscriptions.map(subscription => {
      const { plan } = subscription;
      return {
        plan: {
          id: plan._id,
          name: plan.name,
          type: plan.type,
          price: plan.price,
          currency: plan.currency,
          durationDays: plan.durationDays,
          messageLimit: plan.type === "unlimited" ? null : plan.messageLimit,
          deviceLimit: plan.deviceLimit,
          status: plan.status,
          createdAt: plan.createdAt,
          updatedAt: plan.updatedAt
        },
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        usedMessages: subscription.usedMessages,
        deviceIds: subscription.deviceIds || [],
        isActive: subscription.isActive
      };
    });

    return res.status(200).json({
      success: true,
      message: "User subscriptions fetched successfully",
      data: subscriptionsData
    });

  } catch (error) {
    console.error("Error fetching user subscriptions:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error", 
      data: null 
    });
  }
};
