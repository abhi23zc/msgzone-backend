import mongoose from "mongoose";

const activitySchema = new mongoose.Schema({
  title: String,
  description: String,
  type: {
    type: String,
    enum: ['signup', 'transaction', 'alert', 'upgrade', 'general'],
    default: 'general'
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const ActivityLog = mongoose.model("ActivityLog", activitySchema);
