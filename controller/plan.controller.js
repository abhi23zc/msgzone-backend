import { User } from "../models/user.Schema.js";
import redis from "../utils/redis.js";

export const getUserActivePlan = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "User not found" });
    }

    // ✅ check Redis cache
    const key = `sub:${userId}`;
    let planData = await redis.hgetall(key);

    let subscriptionData;

    if (planData && Object.keys(planData).length > 0) {
      subscriptionData = {
        plan: {
          _id: planData.planId,
          name: planData.name,
          type: planData.type,
          messageLimit: planData.type === "unlimited" ? null : parseInt(planData.limit),
          deviceLimit: parseInt(planData.deviceLimit),
          currency: planData.currency,
          durationDays: parseInt(planData.durationDays),
          price: parseFloat(planData.price),
          status: planData.status
        },
        startDate: new Date(parseInt(planData.startDate)),
        endDate: new Date(parseInt(planData.endDate)),
        usedMessages: parseInt(planData.used)
      };
    } else {
      // Fallback to MongoDB if Redis cache miss
      const user = await User.findById(userId)
        .populate("subscription.plan")
        .select("subscription");

      if (!user?.subscription?.plan) {
        return res.status(404).json({ message: "No active subscription plan found" });
      }

      // Verify plan is active
      if (user.subscription.plan.status !== "active") {
        return res.status(400).json({ message: "Subscription plan is inactive" });
      }

      subscriptionData = user.subscription;

      // ✅Cache the plan data in Redis
      await redis.hmset(key, {
        planId: user.subscription.plan._id.toString(),
        name: user.subscription.plan.name,
        type: user.subscription.plan.type,
        limit: user.subscription.plan.messageLimit?.toString() || "0",
        deviceLimit: user.subscription.plan.deviceLimit?.toString(),
        currency: user.subscription.plan.currency,
        durationDays: user.subscription.plan.durationDays?.toString(),
        price: user.subscription.plan.price?.toString(),
        status: user.subscription.plan.status,
        used: user.subscription.usedMessages?.toString() || "0",
        startDate: user.subscription.startDate.getTime().toString(),
        endDate: user.subscription.endDate.getTime().toString()
      });

      // Set expiry to match plan end date
      await redis.expireat(key, Math.floor(user.subscription.endDate.getTime() / 1000));
    }

    res.json({
      status: true,
      message: "Active subscription plan fetched successfully",
      data: {
        plan: {
          ...subscriptionData.plan,
          messageLimit: subscriptionData.plan.type === "unlimited" ? null : (subscriptionData.plan.messageLimit || 0),
          deviceLimit: subscriptionData.plan.deviceLimit
        },
        startDate: subscriptionData.startDate,
        endDate: subscriptionData.endDate,
        usedMessages: subscriptionData.usedMessages
      }
    });

  } catch (error) {
    console.error("Error fetching user active plan:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};