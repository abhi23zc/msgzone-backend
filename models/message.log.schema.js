import mongoose from "mongoose";
const messageLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    messages: [{
        text: String,
        sendFrom: String,
        sendTo: String,

        attachments: [String],
        createdAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['delivered', 'error'], default: 'delivered' },
        sentAt: Date,

    }],
    number: String,
    status: { type: String, enum: ['delivered', 'error', 'scheduled'], default: 'delivered' },
    scheduledTime: Date,
    sentAt: Date,
});

export const MessageLog = mongoose.model('MessageLog', messageLogSchema);
