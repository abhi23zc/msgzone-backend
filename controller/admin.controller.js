import { User } from "../models/user.Schema.js";
import { MessageLog } from "../models/_message.log.schema.js";
import { ActivityLog } from "../models/activity.Schma.js";

export const getDashboardStats = async (req, res) => {
  try {
    const userId = req?.user?.userId;

    const totalUsers = await User.countDocuments({ role: "user" });
    const activeUsers = await User.countDocuments({
      role: "user",
      isActive: true,
    });
    const dormantAccounts = await User.countDocuments({
      role: "user", 
      isActive: false,
    });
    const userIds = await User.find({ role: "user" }).distinct("_id");

    const totalMessages = await MessageLog.countDocuments({
      userId: { $in: userIds },
    });

    const totalRevenue = 452831;

    res.json({
      status: true,
      message: "Dashboard Stats",
      data: {
        totalUsers,
        activeUsers,
        dormantAccounts,
        totalMessages,
        totalRevenue,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Failed to fetch dashboard stats",
      data: null
    });
  }
};

export const getWeeklyMessageStats = async (req, res) => {
  try {
    const userId = req?.user?.userId;
    const userIds = await User.find({ role: "user" }).distinct("_id");
    const today = new Date();

    const last7Days = [...Array(7)].map((_, i) => {
      const date = new Date();
      date.setUTCDate(today.getUTCDate() - i);
      date.setUTCHours(0, 0, 0, 0);

      return {
        day: date.toLocaleDateString("en-US", { weekday: "short" }),
        date,
      };
    });

    const stats = await Promise.all(
      last7Days.map(async ({ day, date }) => {
        const nextDate = new Date(date);
        nextDate.setUTCDate(date.getUTCDate() + 1);

        const count = await MessageLog.countDocuments({
          userId: { $in: userIds },
          createdAt: { $gte: date, $lt: nextDate },
        });

        return { day, count };
      })
    );

    res.json({
      status: true,
      message: "Weekly message stats retrieved successfully",
      data: stats.reverse()
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: "Failed to fetch weekly message stats",
      data: null
    });
  }
};

export const getUserGrowthStats = async (req, res) => {
  try {
    const userId = req?.user?.userId;
    const today = new Date();

    const last7Days = [...Array(7)].map((_, i) => {
      const date = new Date();
      date.setUTCDate(today.getUTCDate() - i);
      date.setUTCHours(0, 0, 0, 0);

      return {
        day: date.toLocaleDateString("en-US", { weekday: "short" }),
        date,
      };
    });

    const stats = await Promise.all(
      last7Days.map(async ({ day, date }) => {
        const nextDate = new Date(date);
        nextDate.setUTCDate(date.getUTCDate() + 1);

        const count = await User.countDocuments({
          role: "user",
          createdAt: { $gte: date, $lt: nextDate },
        });

        return { day, count };
      })
    );

    res.json({
      status: true,
      message: "User growth stats retrieved successfully",
      data: stats.reverse()
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: "Failed to fetch user growth stats",
      data: null
    });
  }
};

export const getLiveActivity = async (req, res) => {
  try {
    const userId = req?.user?.userId;
    const userIds = await User.find({ role: "user" }).distinct("_id");

    const activities = await ActivityLog.find({ userId: { $in: userIds } })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      status: true,
      message: "Live activities retrieved successfully",
      data: activities
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Failed to fetch live activity",
      data: null
    });
  }
};


export const setAdminDevice = async (req, res) => {
  try {
    const { deviceId } = req.body;
    const userId = req?.user?.userId;
    const user = await User.findById(userId);
    user.adminDevice = deviceId;
    await user.save();
    res.json({
      status: true,
      message: "Admin device set successfully",
      data: null
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: "Failed to set admin device",
      data: null
    });
  }
};