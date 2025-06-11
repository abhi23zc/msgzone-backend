import mongoose from "mongoose";

const DeviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
    },
    // whatsappNumber: {
    //   type: String,
    //   required: true,
    // },
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
  { _id: false } // Prevent auto-generating _id for each device
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
      minlength: 6,
      select: false,
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
      ref: "User",
      required: function () {
        return this.role === "user";
      },
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model("User", UserSchema);
