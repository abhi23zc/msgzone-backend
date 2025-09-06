import mongoose from "mongoose";

const PaymentSettingsSchema = new mongoose.Schema({
  // QR Code & UPI Settings
  qrUpiEnabled: {
    type: Boolean,
    default: false,
  },
  qrCodeImage: {
    type: String, // URL or path to QR code image
    default: "",
  },
  upiId: {
    type: String,
    default: "",
  },
  upiName: {
    type: String,
    default: "",
  },

  // Bank Account Settings
  bankAccountEnabled: {
    type: Boolean,
    default: false,
  },
  bankDetails: {
    accountHolderName: {
      type: String,
      default: "",
    },
    bankName: {
      type: String,
      default: "",
    },
    accountNumber: {
      type: String,
      default: "",
    },
    ifscCode: {
      type: String,
      default: "",
    },
    branchName: {
      type: String,
      default: "",
    },
  },

  // General Settings
  currency: {
    type: String,
    default: "INR",
  },
  taxRate: {
    type: Number,
    default: 0,
  },
  processingFee: {
    type: Number,
    default: 0,
  },

  // Metadata
  isActive: {
    type: Boolean,
    default: true,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

// Update lastUpdated field on save
PaymentSettingsSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

export const PaymentSettings = mongoose.model("PaymentSettings", PaymentSettingsSchema);
