import { Plan } from "../models/plan.schema.js";
import { User } from "../models/user.Schema.js";
import redisClient from "../utils/redis.js";

export const createPlan = async (req, res) => {
  try {
    // Validate plan type and required fields
    const { type, deviceLimit, durationDays, price } = req.body;
    if (!type || !deviceLimit || !durationDays || !price) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        data: {}
      });
    }

    // Validate message limit for limited plans
    if (type === "limited" && !req.body.messageLimit) {
      return res.status(400).json({
        success: false,
        message: "Message limit required for limited plans",
        data: {}
      });
    }

    const plan = await Plan.create(req.body);
    res.status(201).json({ 
      success: true, 
      message: "Plan created successfully",
      data: { plan }
    });
  } catch (err) {
    res.status(400).json({ 
      success: false, 
      message: err.message,
      data: {}
    });
  }
};

export const getAllPlans = async (req, res) => {
  try {
    const plans = await Plan.find().sort({ createdAt: -1 });
    res.json({ 
      success: true, 
      message: "Plans retrieved successfully",
      data: { plans }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
      data: {}
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
          data: {}
        });
      }
    }

    const plan = await Plan.findByIdAndUpdate(
      req.params.id, 
      req.body,
      { new: true, runValidators: true }
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
        data: {}
      });
    }

    res.json({ 
      success: true, 
      message: "Plan updated successfully",
      data: { plan }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
      data: {}
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
        data: {}
      });
    }

    res.json({ 
      success: true, 
      message: "Plan deleted successfully",
      data: {}
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
      data: {}
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
        data: {}
      });
    }

    const now = new Date();
    const end = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    const subscriptionData = {
      plan: plan._id,
      startDate: now,
      endDate: end,
      usedMessages: 0,
      deviceIds: [],
      messageLimit: plan.type === "limited" ? plan.messageLimit : null,
      deviceLimit: plan.deviceLimit
    };

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { subscription: subscriptionData } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        data: {}
      });
    }

    return res.json({ 
      success: true, 
      message: "Plan assigned successfully",
      data: { user }
    });
  } catch (error) {
    console.error("Assign Plan Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error",
      data: {}
    });
  }
};
