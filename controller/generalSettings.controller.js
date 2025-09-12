import { GeneralSettings } from "../models/generalSettings.schema.js";
import path from "path";

// GET /admin/general-settings - Get current general settings
export const getGeneralSettings = async (req, res) => {
  try {
    // Get the most recent general settings (there should only be one active)
    const settings = await GeneralSettings.findOne({ isActive: true })
      .populate("updatedBy", "name email")
      .sort({ lastUpdated: -1 });

    if (!settings) {
      // Return default settings if none exist
      return res.status(200).json({
        success: true,
        message: "General settings retrieved successfully",
        data: {
          systemName: "MsgZone",
          adminEmail: "admin@msgzone.com",
          logoUrl: "",
          timezone: "UTC",
          language: "en",
          companyName: "",
          companyAddress: "",
          companyPhone: "",
          companyWebsite: "",
          maintenanceMode: false,
          allowRegistration: true,
          emailNotifications: true,
          smsNotifications: true,
          isActive: true,
          lastUpdated: new Date(),
          updatedBy: null,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "General settings retrieved successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Get general settings error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: {},
    });
  }
};

// PUT /admin/general-settings - Update general settings
export const updateGeneralSettings = async (req, res) => {
  try {
    const {
      systemName,
      adminEmail,
      logoUrl,
      timezone,
      language,
      companyName,
      companyAddress,
      companyPhone,
      companyWebsite,
      maintenanceMode,
      allowRegistration,
      emailNotifications,
      smsNotifications,
    } = req.body;

    const userId = req.user?.userId;

    // Validate required fields
    if (!systemName) {
      return res.status(400).json({
        success: false,
        message: "System name is required",
        data: {},
      });
    }

    // Validate email format if adminEmail is provided
    if (adminEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(adminEmail)) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid admin email address",
          data: {},
        });
      }
    }

    // Validate timezone
    const validTimezones = [
      "UTC",
      "Asia/Kolkata",
      "America/New_York",
      "Europe/London",
      "Asia/Tokyo",
      "Australia/Sydney",
    ];
    if (timezone && !validTimezones.includes(timezone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid timezone selected",
        data: {},
      });
    }

    // Validate language
    const validLanguages = ["en", "hi", "es", "fr", "de", "ja"];
    if (language && !validLanguages.includes(language)) {
      return res.status(400).json({
        success: false,
        message: "Invalid language selected",
        data: {},
      });
    }

    // Find existing active settings or create new one
    let existingSettings = await GeneralSettings.findOne({ isActive: true });

    if (existingSettings) {
      // Update existing settings
      existingSettings.systemName = systemName.trim();
      existingSettings.adminEmail = adminEmail ? adminEmail.trim().toLowerCase() : existingSettings.adminEmail || "admin@msgzone.com";
      existingSettings.logoUrl = logoUrl || "";
      existingSettings.timezone = timezone || existingSettings.timezone || "UTC";
      existingSettings.language = language || existingSettings.language || "en";
      existingSettings.companyName = companyName || "";
      existingSettings.companyAddress = companyAddress || "";
      existingSettings.companyPhone = companyPhone || "";
      existingSettings.companyWebsite = companyWebsite || "";
      existingSettings.maintenanceMode = maintenanceMode || false;
      existingSettings.allowRegistration = allowRegistration !== undefined ? allowRegistration : true;
      existingSettings.emailNotifications = emailNotifications !== undefined ? emailNotifications : true;
      existingSettings.smsNotifications = smsNotifications !== undefined ? smsNotifications : true;
      existingSettings.updatedBy = userId;
      existingSettings.lastUpdated = new Date();

      await existingSettings.save();
      var newSettings = existingSettings;
    } else {
      // Create new settings if none exist
      newSettings = await GeneralSettings.create({
        systemName: systemName.trim(),
        adminEmail: adminEmail ? adminEmail.trim().toLowerCase() : "admin@msgzone.com",
        logoUrl: logoUrl || "",
        timezone: timezone || "UTC",
        language: language || "en",
        companyName: companyName || "",
        companyAddress: companyAddress || "",
        companyPhone: companyPhone || "",
        companyWebsite: companyWebsite || "",
        maintenanceMode: maintenanceMode || false,
        allowRegistration: allowRegistration !== undefined ? allowRegistration : true,
        emailNotifications: emailNotifications !== undefined ? emailNotifications : true,
        smsNotifications: smsNotifications !== undefined ? smsNotifications : true,
        isActive: true,
        updatedBy: userId,
      });
    }

    return res.status(200).json({
      success: true,
      message: "General settings updated successfully",
      data: newSettings,
    });
  } catch (error) {
    console.error("Update general settings error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: {},
    });
  }
};

// GET /general-settings - Get general settings for users (public endpoint)
export const getPublicGeneralSettings = async (req, res) => {
  try {
    // Get the most recent active general settings
    const settings = await GeneralSettings.findOne({ isActive: true })
      .sort({ lastUpdated: -1 });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "General settings not found",
        data: {},
      });
    }

    // Return only the necessary data for users (no sensitive info)
    const publicSettings = {
      systemName: settings.systemName,
      logoUrl: settings.logoUrl,
      timezone: settings.timezone,
      language: settings.language,
      companyName: settings.companyName,
      companyAddress: settings.companyAddress,
      companyPhone: settings.companyPhone,
      companyWebsite: settings.companyWebsite,
      maintenanceMode: settings.maintenanceMode,
      allowRegistration: settings.allowRegistration,
    };

    return res.status(200).json({
      success: true,
      message: "General settings retrieved successfully",
      data: publicSettings,
    });
  } catch (error) {
    console.error("Get public general settings error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: {},
    });
  }
};

// GET /admin/general-settings/history - Get general settings history
export const getGeneralSettingsHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const settings = await GeneralSettings.find()
      .populate("updatedBy", "name email")
      .sort({ lastUpdated: -1 })
      .skip(skip)
      .limit(limit);

    const total = await GeneralSettings.countDocuments();

    return res.status(200).json({
      success: true,
      message: "General settings history retrieved successfully",
      data: {
        settings,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
        },
      },
    });
  } catch (error) {
    console.error("Get general settings history error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: {},
    });
  }
};

// POST /admin/general-settings/upload-logo - Upload logo file
export const uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No logo file uploaded",
        data: {},
      });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Only JPEG, PNG, SVG, and WebP images are allowed",
        data: {},
      });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: "File size too large. Maximum size is 5MB",
        data: {},
      });
    }

    // Create the logo URL (relative path)
    const logoUrl = `/uploads/${req.file.filename}`;

    return res.status(200).json({
      success: true,
      message: "Logo uploaded successfully",
      data: {
        logoUrl: logoUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (error) {
    console.error("Upload logo error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: {},
    });
  }
};
