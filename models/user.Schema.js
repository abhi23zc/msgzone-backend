import mongoose from "mongoose";

const DeviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
    },
    number:{
      type:String
    },
    status: {
      type: String,
      enum: ["connected", "disconnected", "auth_failure"],
      default: "disconnected",
    },
    lastConnected: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false } 
);

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
    },
    businessName: {
      type: String,
    },
    whatsappNumber: {
      type: String,
      required: [true, "WhatsApp number is required"],
      unique: true,
    },
    alternateNumber: {
      type: String,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    address: {
      type: String,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      code: { type: String },
      expiresAt: { type: Date },
    },

    profilePhoto: {
      type: String,
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    devices: {
      type: [DeviceSchema],
      default: [],
    },
    subscriptions: [{
      plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
      startDate: Date,
      endDate: Date,
      usedMessages: { type: Number, default: 0 },
      deviceIds: [String],
      isActive: { type: Boolean, default: false } 
    }],

    enableCode: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
    token: String,
    lastLogin: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model("User", UserSchema);
