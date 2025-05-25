import { MessageLog } from "../models/message.log.schema.js";
export const getAllMessages = async (req, res, next) => {
  try {
    const userId = req?.user?.userId;
    const messageLogs = await MessageLog.find({ userId });
    if (!messageLogs)
      return res.json({
        success: false,
        data: null,
        message: "No Messages found",
      });
    return res.json({
      success: true,
      data: messageLogs,
      message: "Messages found",
    });
  } catch (error) {
    return res.json({
      success: false,
      data: null,
      message: "Server error occured",
    });
  }
};
export const getTodayMessages = async (req, res, next) => {
    try {
      const userId = req?.user?.userId;
  
      
      const messageLogs = await MessageLog.find({ userId });
  
      
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
  
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
  
  
      const todayMessages = [];
  
      messageLogs.forEach((log) => {
        const todays = log.messages.filter((msg) => {
          const msgDate = new Date(msg.createdAt);
          return msgDate >= startOfToday && msgDate <= endOfToday;
        });
        todayMessages.push(...todays); 
      });
  
      if (!todayMessages.length) {
        return res.json({
          success: false,
          data: null,
          message: "No messages found for today",
        });
      }
  
      return res.json({
        success: true,
        data: todayMessages,
        message: "Messages found",
      });
    } catch (error) {
      return res.json({
        success: false,
        data: null,
        message: "Server error occurred",
      });
    }
  };
  