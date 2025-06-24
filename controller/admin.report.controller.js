import { MessageLog } from "../models/_message.log.schema.js";
import { User } from "../models/user.Schema.js";

export const getMessageReportStats = async (req, res) => {
  try {
    const adminId = req?.user?.userId;
    const userIds = await User.find({ createdBy: adminId }).distinct("_id");

    const totalMessages = await MessageLog.countDocuments({
      userId: { $in: userIds },
    });

    const deliveredMessages = await MessageLog.countDocuments({
      userId: { $in: userIds },
      status: "delivered",
    });

    const failedMessages = await MessageLog.countDocuments({
      userId: { $in: userIds },
      status: "error",
    });

    // Calculate percentage change over last 30 days
    const now = new Date();
    const start30 = new Date(now);
    start30.setDate(start30.getDate() - 30);
    const start60 = new Date(now);
    start60.setDate(start60.getDate() - 60);

    const last30 = await MessageLog.countDocuments({
      userId: { $in: userIds },
      createdAt: { $gte: start30 },
    });

    const prev30 = await MessageLog.countDocuments({
      userId: { $in: userIds },
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
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      message: "Failed to fetch report stats",
      data: {}
    });
  }
};

export const getMessageReportList = async (req, res) => {
  try {
    const adminId = req?.user?.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { from, to } = req.query;

    // Fetch all user IDs created by the admin
    const userIds = await User.find({ createdBy: adminId }).distinct("_id");

    // Build query object
    const query = { userId: { $in: userIds } };

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    // Get total count for pagination
    const totalCount = await MessageLog.countDocuments(query);

    // Fetch messages with pagination
    const messages = await MessageLog.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("userId", "name");

    const results = messages.map((msg) => {
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
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      message: "Failed to fetch message reports",
      data: {}
    });
  }
};

function capitalize(str) {
  return str[0].toUpperCase() + str.slice(1);
}
