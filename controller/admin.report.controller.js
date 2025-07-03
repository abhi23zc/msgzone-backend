import { MessageLog } from "../models/_message.log.schema.js";
import { User } from "../models/user.Schema.js";


export const getMessageReportStats = async (req, res) => {
  try {
    // Get all non-admin user IDs
    const nonAdminUserIds = await User.find({ role: { $ne: "admin" } }).distinct("_id");
    const baseQuery = { userId: { $in: nonAdminUserIds } };

    const totalMessages = await MessageLog.countDocuments(baseQuery);
    const deliveredMessages = await MessageLog.countDocuments({ ...baseQuery, status: "delivered" });
    const failedMessages = await MessageLog.countDocuments({ ...baseQuery, status: "error" });

    const now = new Date();
    const start30 = new Date(now);
    start30.setDate(start30.getDate() - 30);
    const start60 = new Date(now);
    start60.setDate(start60.getDate() - 60);

    const last30 = await MessageLog.countDocuments({
      ...baseQuery,
      createdAt: { $gte: start30 },
    });

    const prev30 = await MessageLog.countDocuments({
      ...baseQuery,
      createdAt: { $gte: start60, $lt: start30 },
    });

    const percentChange = prev30 > 0 ? ((last30 - prev30) / prev30) * 100 : 0;

    return res.json({
      status: true,
      message: "Report stats fetched successfully",
      data: {
        totalMessages,
        deliveredMessages,
        failedMessages,
        percentChange: percentChange.toFixed(2),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      message: "Failed to fetch report stats",
      data: {},
    });
  }
};

export const getMessageReportList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { from, to, status, search } = req.query;

    const query = {};

    // Date filtering
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    // Status filtering
    if (status && status !== "all") {
      query.status = status.toLowerCase(); // store all lowercase in DB
    }

    // Exclude admin users
    const nonAdminUserIds = await User.find({ role: { $ne: "admin" } }).distinct("_id");
    query.userId = { $in: nonAdminUserIds };

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { sendTo: searchRegex },
        { text: searchRegex },
      ];
    }

    const totalCount = await MessageLog.countDocuments(query);

    const messages = await MessageLog.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("userId", "name role");

    let filteredMessages = messages;

    if (search) {
      const searchLower = search.toLowerCase();
      filteredMessages = messages.filter((msg) =>
        msg.userId?.name?.toLowerCase().includes(searchLower)
      );
    }

    // Filter out any message where user is admin (extra safety)
    filteredMessages = filteredMessages.filter(msg => msg.userId?.role !== "admin");

    const results = filteredMessages.map((msg) => {
      const sent = msg.sentAt || msg.createdAt;
      return {
        recipient: msg.sendTo,
        message: msg.text || "-",
        status: msg.status === "error" ? "Failed" : capitalize(msg.status),
        sentTime: sent?.toISOString(),
        type: msg.type,
        sendThrough: msg?.sendThrough,
        user: msg.userId?.name || "N/A",
        createdAt: msg.createdAt?.toISOString(),
      };
    });

    return res.json({
      status: true,
      message: "Message reports fetched successfully",
      data: {
        results,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      message: "Failed to fetch message reports",
      data: {},
    });
  }
};

function capitalize(str) {
  return str[0].toUpperCase() + str.slice(1);
}

