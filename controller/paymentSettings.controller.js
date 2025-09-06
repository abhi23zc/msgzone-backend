import { PaymentSettings } from "../models/paymentSettings.schema.js";

// GET /admin/payment-settings - Get current payment settings
export const getPaymentSettings = async (req, res) => {
  try {
    // Get the most recent payment settings (there should only be one active)
    const settings = await PaymentSettings.findOne({ isActive: true })
      .populate("updatedBy", "name email")
      .sort({ lastUpdated: -1 });

    if (!settings) {
      // Return default settings if none exist
      return res.status(200).json({
        success: true,
        message: "Payment settings retrieved successfully",
        data: {
          qrUpiEnabled: false,
          qrCodeImage: "",
          upiId: "",
          upiName: "",
          bankAccountEnabled: false,
          bankDetails: {
            accountHolderName: "",
            bankName: "",
            accountNumber: "",
            ifscCode: "",
            branchName: "",
          },
          currency: "INR",
          taxRate: 0,
          processingFee: 0,
          isActive: true,
          lastUpdated: new Date(),
          updatedBy: null,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment settings retrieved successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Get payment settings error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: {},
    });
  }
};

// PUT /admin/payment-settings - Update payment settings
export const updatePaymentSettings = async (req, res) => {
  try {
    const {
      qrUpiEnabled,
      qrCodeImage,
      upiId,
      bankAccountEnabled,
      bankDetails,
      currency,
      taxRate,
      processingFee,
    } = req.body;

    const userId = req.user?.userId;

    // Validate that only one payment method is enabled
    if (qrUpiEnabled && bankAccountEnabled) {
      return res.status(400).json({
        success: false,
        message: "Only one payment method can be enabled at a time",
        data: {},
      });
    }

    // Validate bank details if bank account is enabled
    if (bankAccountEnabled && bankDetails) {
      const { accountHolderName, bankName, accountNumber, ifscCode, branchName } = bankDetails;
      if (!accountHolderName || !bankName || !accountNumber || !ifscCode || !branchName) {
        return res.status(400).json({
          success: false,
          message: "All bank details are required when bank account is enabled",
          data: {},
        });
      }
    }

    // Validate UPI details if QR/UPI is enabled
    if (qrUpiEnabled && (!upiId)) {
      return res.status(400).json({
        success: false,
        message: "UPI ID and UPI Name are required when QR/UPI is enabled",
        data: {},
      });
    }

    // Deactivate all existing settings
    await PaymentSettings.updateMany({ isActive: true }, { isActive: false });

    // Create new settings
    const newSettings = await PaymentSettings.create({
      qrUpiEnabled,
      qrCodeImage: qrCodeImage || "",
      upiId: upiId || "",
      bankAccountEnabled,
      bankDetails: bankAccountEnabled ? bankDetails : {
        accountHolderName: "",
        bankName: "",
        accountNumber: "",
        ifscCode: "",
        branchName: "",
      },
      currency: currency || "INR",
      taxRate: taxRate || 0,
      processingFee: processingFee || 0,
      isActive: true,
      updatedBy: userId,
    });

    return res.status(200).json({
      success: true,
      message: "Payment settings updated successfully",
      data: newSettings,
    });
  } catch (error) {
    console.error("Update payment settings error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: {},
    });
  }
};

// GET /payment-settings - Get payment settings for users (public endpoint)
export const getPublicPaymentSettings = async (req, res) => {
  try {
    // Get the most recent active payment settings
    const settings = await PaymentSettings.findOne({ isActive: true })
      .sort({ lastUpdated: -1 });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Payment settings not found",
        data: {},
      });
    }

    // Return only the necessary data for users (no sensitive info)
    const publicSettings = {
      qrUpiEnabled: settings.qrUpiEnabled,
      qrCodeImage: settings.qrCodeImage,
      upiId: settings.upiId,
      upiName: settings.upiName,
      bankAccountEnabled: settings.bankAccountEnabled,
      bankDetails: settings.bankAccountEnabled ? settings.bankDetails : null,
      currency: settings.currency,
      taxRate: settings.taxRate,
      processingFee: settings.processingFee,
    };

    return res.status(200).json({
      success: true,
      message: "Payment settings retrieved successfully",
      data: publicSettings,
    });
  } catch (error) {
    console.error("Get public payment settings error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: {},
    });
  }
};
