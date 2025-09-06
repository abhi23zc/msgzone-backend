import { MessageLog } from "../models/_message.log.schema.js";

// ✅ Get all messages for the current user
// export const getAllMessages = async (req, res) => {
//   try {
//     const userId = req?.user?.userId;
//     const limit = parseInt(req.query.limit) || 50;
//     const page = parseInt(req.query.page) || 1;
//     const skip = (page - 1) * limit;

//     const { from, to } = req.query;

//     // Build query object
//     const query = { userId };

//     if (from || to) {
//       query.createdAt = {};
//       if (from) query.createdAt.$gte = new Date(from);
//       if (to) query.createdAt.$lte = new Date(to);
//     }

//     const totalMessages = await MessageLog.countDocuments(query);

//     const messageLogs = await MessageLog.find(query)
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit);

//     return res.json({
//       success: true,
//       data: messageLogs,
//       currentPage: page,
//       totalPages: Math.ceil(totalMessages / limit),
//       totalMessages,
//       message: "Messages retrieved successfully",
//     });
//   } catch (error) {
//     console.error("Error getting messages:", error);
//     return res.status(500).json({
//       success: false,
//       data: null,
//       message: "Server error occurred",
//     });
//   }
// };

export const getAllMessages = async (req, res) => {
  try {
    const userId = req?.user?.userId;
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const { from, to, status, search } = req.query;

    // Base query for this user
    const query = { userId };

    // Date filter
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    // Status filter
    if (status && status !== "all") {
      query.status = status;
    }

    // Search filter (in sendFrom, sendTo, or text)
    if (search) {
      query.$or = [
        { sendFrom: { $regex: search, $options: "i" } },
        { sendTo: { $regex: search, $options: "i" } },
        { text: { $regex: search, $options: "i" } },
      ];
    }

    const totalMessages = await MessageLog.countDocuments(query);

    const messageLogs = await MessageLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.json({
      success: true,
      data: messageLogs,
      currentPage: page,
      totalPages: Math.ceil(totalMessages / limit),
      totalMessages,
      message: "Messages retrieved successfully",
    });
  } catch (error) {
    console.error("Error getting messages:", error);
    return res.status(500).json({
      success: false,
      data: null,
      message: "Server error occurred",
    });
  }
};



// ✅ Get only today's messages for the current user
export const getTodayMessages = async (req, res) => {
  try {
    const userId = req?.user?.userId;
    const limit = parseInt(req.query.limit) || 50;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const messages = await MessageLog.find({
      userId,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    console.error("Error fetching today's messages:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Get all messages count for current user 
export const getTotalMessageCount = async (req, res) => {
  try {
    const userId = req?.user?.userId;
    const count = await MessageLog.countDocuments({ userId });

    return res.json({
      success: true,
      data: count,
      message: "Total messages count retrieved successfully",
    });
  } catch (error) {
    console.error("Error getting message count:", error);
    return res.status(500).json({
      success: false,
      data: null,
      message: "Server error occurred",
    });
  }
};

// ✅ Get today's messages count for current user
export const getTodayMessageCount = async (req, res) => {
  try {
    const userId = req?.user?.userId;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const count = await MessageLog.countDocuments({
      userId,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    return res.json({
      success: true,
      data: count,
      message: "Today's message count retrieved successfully",
    });
  } catch (error) {
    console.error("Error getting today's message count:", error);
    return res.status(500).json({
      success: false,
      data: null,
      message: "Server error occurred",
    });
  }
};

// ✅ Export messages to CSV
export const exportMessagesToCSV = async (req, res) => {
  try {
    const userId = req?.user?.userId;

    // Get all messages for the user without any filters
    const messages = await MessageLog.find({ userId })
      .sort({ createdAt: -1 });

    // Convert to CSV format
    const csvHeaders = [
      'S.No',
      'Sender',
      'Recipient', 
      'Message',
      'Status',
      'Mode',
      'Time'
    ];

    const csvRows = messages.map((msg, index) => [
      index + 1,
      msg.sendFrom || '',
      msg.sendTo || '',
      `"${(msg.text || '').replace(/"/g, '""')}"`, // Escape quotes in text
      msg.status || '',
      msg.sendThrough || '',
      new Date(msg.createdAt).toLocaleString()
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="messages_${new Date().toISOString().split('T')[0]}.csv"`);
    
    return res.send(csvContent);

  } catch (error) {
    console.error("Error exporting messages to CSV:", error);
    return res.status(500).json({
      success: false,
      data: null,
      message: "Server error occurred while exporting CSV",
    });
  }
};
