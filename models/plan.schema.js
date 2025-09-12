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
    default:0,
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
  order: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

export const Plan =  mongoose.model("Plan", planSchema);
