import {MessageLog} from '../models/message.log.schema.js'
export const getAllMessages =async (req, res, next)=>{
    try {
        const userId = req?.user?.userId;
        const messageLogs = await MessageLog.find({userId});
        if(!messageLogs) return res.json({success:false, data:null, message:"No Messages found"})
        return res.json({success:true, data:messageLogs, message:"Messages found"}) 
    } catch (error) {
        return res.json({success:false, data:null, message:"Server error occured"})
    }
}

