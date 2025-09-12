import mongoose from "mongoose";

const GeneralSettingsSchema = new mongoose.Schema({
  // System Information
  systemName: {
    type: String,
    required: true,
    default: "MsgZone",
    trim: true,
  },
  adminEmail: {
    type: String,
    required: false,
    default: "admin@msgzone.com",
    trim: true,
    lowercase: true,
  },
  logoUrl: {
    type: String,
    default: "",
    trim: true,
  },

  // Basic Settings
  timezone: {
    type: String,
    default: "UTC",
    trim: true,
  },
  language: {
    type: String,
    default: "en",
    trim: true,
  },

  // Additional System Settings
  companyName: {
    type: String,
    default: "",
    trim: true,
  },
  companyAddress: {
    type: String,
    default: "",
    trim: true,
  },
  companyPhone: {
    type: String,
    default: "",
    trim: true,
  },
  companyWebsite: {
    type: String,
    default: "",
    trim: true,
  },

  // System Preferences
  maintenanceMode: {
    type: Boolean,
    default: false,
  },
  allowRegistration: {
    type: Boolean,
    default: true,
  },
  emailNotifications: {
    type: Boolean,
    default: true,
  },
  smsNotifications: {
    type: Boolean,
    default: true,
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
GeneralSettingsSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Index for active settings
GeneralSettingsSchema.index({ isActive: 1 });

export const GeneralSettings = mongoose.model("GeneralSettings", GeneralSettingsSchema);
