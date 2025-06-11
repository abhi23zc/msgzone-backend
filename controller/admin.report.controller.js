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

    res.json({
      totalMessages,
      deliveredMessages,
      failedMessages,
      percentChange: percentChange.toFixed(2),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch report stats" });
  }
};
export const getMessageReportList = async (req, res) => {
  try {
    const adminId = req?.user?.userId;

    // Fetch all user IDs created by the admin
    const userIds = await User.find({ createdBy: adminId }).distinct("_id");

    // Fetch all messages with user details
    const messages = await MessageLog.find({ userId: { $in: userIds } })
      .limit(20)
      .sort({ createdAt: -1 })
      .populate("userId", "name");

    const results = messages.map((msg) => {
      const sent = msg.sentAt || msg.createdAt;

      return {
        recipient: msg.sendTo,
        message: msg.text || "-",
        status: msg.status === "error" ? "Failed" : capitalize(msg.status),
        sentTime: sent?.toISOString(),

        user: msg.userId?.name || "N/A",
        createdAt: msg.createdAt?.toISOString(),
      };
    });

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch message reports" });
  }
};

function capitalize(str) {
  return str[0].toUpperCase() + str.slice(1);
}
