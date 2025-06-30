import { User } from "../models/user.Schema.js";

export const getUserActivePlan = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User not found", data: null });
    }

    const user = await User.findById(userId)
      .populate("subscriptions.plan")
      .select("subscriptions");

    if (!user?.subscriptions?.length) {
      return res
        .status(404)
        .json({
          success: false,
          message: "No subscriptions found",
          data: null,
        });
    }

    const activeSub = user.subscriptions.find((sub) => sub.status === "active");
    if (!activeSub?.plan) {
      return res
        .status(404)
        .json({
          success: false,
          message: "No active subscription plan found",
          data: null,
        });
    }

    // 🟢 Check active is active or inactive by admin
    const { plan } = activeSub;
    if (plan.status !== "active") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Subscription plan is inactive",
          data: null,
        });
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
      updatedAt: plan.updatedAt,
    };

    const responseData = {
      plan: planData,
      startDate: activeSub.startDate,
      endDate: activeSub.endDate,
      usedMessages: activeSub.usedMessages,
      deviceIds: activeSub.deviceIds || [],
      status: activeSub.status,
    };

    return res.status(200).json({
      success: true,
      message: "Active subscription plan fetched successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("Error fetching user active plan:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      data: null,
    });
  }
};
export const getUserSubscriptions = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User not found", data: null });
    }

    const user = await User.findById(userId)
      .populate("subscriptions.plan")
      .select("subscriptions");

    if (!user?.subscriptions?.length) {
      return res
        .status(404)
        .json({
          success: false,
          message: "No subscriptions found",
          data: null,
        });
    }

    const subscriptionsData = user.subscriptions.map((subscription) => {
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
          updatedAt: plan.updatedAt,
        },
        id:subscription._id,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        usedMessages: subscription.usedMessages,
        deviceIds: subscription.deviceIds || [],

        status: subscription.status,
      };
    });

    return res.status(200).json({
      success: true,
      message: "User subscriptions fetched successfully",
      data: subscriptionsData,
    });
  } catch (error) {
    console.error("Error fetching user subscriptions:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      data: null,
    });
  }
}
export const switchToNextPlan = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ 
        success: false, 
        message: "Subscription ID is required" 
      });
    }

    const user = await User.findById(userId).populate("subscriptions.plan");

    if (!user || !user.subscriptions.length) {
      return res.status(404).json({ 
        success: false, 
        message: "No subscriptions found" 
      });
    }

    // Find the requested subscription by its _id
    const targetSubscription = user.subscriptions.find(sub => sub._id.toString() === subscriptionId);
    
    if (!targetSubscription) {
      return res.status(404).json({
        success: false,
        message: "Requested subscription not found"
      });
    }

    if (targetSubscription.status === "active") {
      return res.status(400).json({
        success: false,
        message: "This subscription is already active"
      });
    }

    const now = new Date();

    // Deactivate current active plan
    user.subscriptions = user.subscriptions.map((sub) => {
      if (sub.status === "active") {
        sub.isActive = false;
        sub.status = "expired";
      }
      return sub;
    });

    // Activate the requested subscription
    targetSubscription.startDate = now;
    targetSubscription.endDate = new Date(
      now.getTime() + targetSubscription.plan.durationDays * 24 * 60 * 60 * 1000
    );

    targetSubscription.status = "active";
    targetSubscription.usedMessages = 0;
    targetSubscription.deviceIds = [];

    await user.save();

    res.status(200).json({
      success: true,
      message: "Switched to requested subscription successfully"
    });
  } catch (error) {
    console.error("Switch subscription error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
