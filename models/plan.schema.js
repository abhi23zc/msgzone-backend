import mongoose from "mongoose";

const planSchema = new mongoose.Schema({
  name: String,
  type: {
    type: String,
    enum: ["unlimited", "limited"],
    required: true,
  },
  messageLimit: {
    type: Number, // null for unlimited type
    default: null,
  },
  deviceLimit: {
    type: Number,
    required: true,
  },
  durationDays: {
    type: Number,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: "INR",
  },
  status:{
    type:String,
    enum: ["active", "inactive"],
    default:"active"
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Plan = mongoose.models.Plan || mongoose.model("Plan", planSchema);
