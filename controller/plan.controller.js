import { User } from "../models/user.Schema.js";

export const getUserActivePlan = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "User not found" });
    }

    const user = await User.findById(userId)
      .populate("subscription.plan")
      .select("subscription");

    if (!user?.subscription?.plan) {
      return res
        .status(404)
        .json({ message: "No active subscription plan found" });
    }

    // Verify plan is active
    if (user.subscription.plan.status !== "active") {
      return res.status(400).json({ message: "Subscription plan is inactive" });
    }

    const plan = user.subscription.plan._doc;
    
    res.json({
      status: true,
      message: "Active subscription plan fetched successfully",
      data: {
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
        startDate: user.subscription.startDate,
        endDate: user.subscription.endDate,
        usedMessages: user.subscription.usedMessages
      }
    });
  } catch (error) {
    console.error("Error fetching user active plan:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};
