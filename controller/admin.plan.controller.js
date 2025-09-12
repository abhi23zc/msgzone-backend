import { Plan } from "../models/plan.schema.js";
import { User } from "../models/user.Schema.js";
import redisClient from "../utils/redis.js";

export const createPlan = async (req, res) => {
  try {
    // Validate plan type and required fields
    const { type, deviceLimit, durationDays} = req.body;
    if (!type || !deviceLimit || !durationDays) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        data: {},
      });
    }

    // Validate message limit for limited plans
    if (type === "limited" && !req.body.messageLimit) {
      return res.status(400).json({
        success: false,
        message: "Message limit required for limited plans",
        data: {},
      });
    }

    // Get the highest order number and add 1 for the new plan
    const lastPlan = await Plan.findOne().sort({ order: -1 });
    const newOrder = lastPlan ? (lastPlan.order || 0) + 1 : 1;
    
    const planData = { ...req.body, order: newOrder };
    const plan = await Plan.create(planData);
    res.status(201).json({
      success: true,
      message: "Plan created successfully",
      data: { plan },
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
      data: {},
    });
  }
};

export const getAllPlans = async (req, res) => {
  try {
    let userId = req.user?.userId;
    let user = null;
    let hasFreeTier = false;

    // Check if any plans don't have order field and set default values
    const plansWithoutOrder = await Plan.find({ order: { $exists: false } });
    if (plansWithoutOrder.length > 0) {
      console.log(`Found ${plansWithoutOrder.length} plans without order field, setting default values`);
      for (let i = 0; i < plansWithoutOrder.length; i++) {
        await Plan.findByIdAndUpdate(plansWithoutOrder[i]._id, { order: i + 1 });
      }
    }

    // Find all plans, sorted by order (ascending) then by price descending
    let plans = await Plan.find().sort({ order: 1, price: -1 });

    // If user is authenticated, check if they already have a free tier subscription
    if (userId) {
      user = await User.findById(userId)
        .select("subscriptions")
        .populate("subscriptions.plan");
      if (user && user.subscriptions && user.subscriptions.length > 0) {
        // Check if any subscription is for a plan with name "Free Tier"
        hasFreeTier = user.subscriptions.some(
          (sub) => sub.plan && sub.plan.name === "Free Tier"
        );
      }
    }

    // If user already has a free tier, filter out free tier plans (by name)
    if (hasFreeTier) {
      plans = plans.filter((plan) => plan.name !== "Free Tier");
    }

    res.json({
      success: true,
      message: "Plans retrieved successfully",
      data: { plans },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
      data: {},
    });
  }
};

export const updatePlan = async (req, res) => {
  try {
    // Validate plan type if being updated
    if (req.body.type) {
      if (req.body.type === "limited" && !req.body.messageLimit) {
        return res.status(400).json({
          success: false,
          message: "Message limit required for limited plans",
          data: {},
        });
      }
    }

    const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
        data: {},
      });
    }

    res.json({
      success: true,
      message: "Plan updated successfully",
      data: { plan },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
      data: {},
    });
  }
};

export const deletePlan = async (req, res) => {
  try {
    // Soft delete by updating status to inactive
    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      { status: "inactive" },
      { new: true }
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
        data: {},
      });
    }

    res.json({
      success: true,
      message: "Plan deleted successfully",
      data: {},
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
      data: {},
    });
  }
};

export const assignPlanToUser = async (req, res) => {
  try {
    const { userId, planId } = req.body;

    const plan = await Plan.findById(planId);
    if (!plan || plan.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Plan not found or inactive",
        data: {},
      });
    }

    const user = await User.findById(userId).populate("subscriptions.plan");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        data: {},
      });
    }

    // Find subscriptions where endDate is missing or null
    const hasActive = user.subscriptions?.filter(sub => !sub.endDate);

    const now = new Date();
    const end = new Date(
      now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000
    );

    const subscriptionData = {
      plan: plan._id,
      startDate: hasActive ? null : now,
      endDate: hasActive ? null : end,
      isActive: !hasActive,
       status: hasActive ? "inactive" : "active",
      usedMessages: 0,
      deviceIds: [],
    };

    user.subscriptions.push(subscriptionData);
    await user.save();

    return res.json({
      success: true,
      message: hasActive
        ? "Plan added to queue and will activate later"
        : "Plan assigned and activated successfully",
      data: { user },
    });
  } catch (error) {
    console.error("Assign Plan Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      data: {},
    });
  }
};

export const reorderPlans = async (req, res) => {
  try {
    const { planOrders } = req.body; // Array of { planId, order } objects

    console.log("Reorder request received:", { planOrders });

    if (!planOrders || !Array.isArray(planOrders)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan orders data",
        data: {},
      });
    }

    // Update each plan's order
    const updatePromises = planOrders.map(({ planId, order }) => {
      console.log(`Updating plan ${planId} to order ${order}`);
      return Plan.findByIdAndUpdate(planId, { order }, { new: true });
    });

    const updatedPlans = await Promise.all(updatePromises);
    console.log("Updated plans:", updatedPlans);

    res.json({
      success: true,
      message: "Plans reordered successfully",
      data: { updatedPlans },
    });
  } catch (error) {
    console.error("Reorder Plans Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      data: {},
    });
  }
};
