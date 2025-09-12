import { MessageTemplates } from "../models/messageTemplates.schema.js";

// GET /admin/message-templates
export const getMessageTemplates = async (req, res) => {
  try {
    let templates = await MessageTemplates.findOne({ isActive: true });
    
    // If no templates exist, create default ones
    if (!templates) {
      templates = await MessageTemplates.create({});
    }

    return res.status(200).json({
      success: true,
      message: "Message templates retrieved successfully",
      data: {
        paymentApproval: templates.paymentApproval,
        paymentRejection: templates.paymentRejection,
        paymentPending: templates.paymentPending
      }
    });
  } catch (error) {
    console.error("Error fetching message templates:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: {}
    });
  }
};

// PUT /admin/message-templates
export const updateMessageTemplates = async (req, res) => {
  try {
    const { paymentApproval, paymentRejection, paymentPending } = req.body;

    if (!paymentApproval || !paymentRejection || !paymentPending) {
      return res.status(400).json({
        success: false,
        message: "All template fields are required",
        data: {}
      });
    }

    // Find existing active templates
    let templates = await MessageTemplates.findOne({ isActive: true });

    if (templates) {
      // Update existing templates
      templates.paymentApproval = paymentApproval;
      templates.paymentRejection = paymentRejection;
      templates.paymentPending = paymentPending;
      await templates.save();
    } else {
      // Create new templates
      templates = await MessageTemplates.create({
        paymentApproval,
        paymentRejection,
        paymentPending
      });
    }

    return res.status(200).json({
      success: true,
      message: "Message templates updated successfully",
      data: {
        paymentApproval: templates.paymentApproval,
        paymentRejection: templates.paymentRejection,
        paymentPending: templates.paymentPending
      }
    });
  } catch (error) {
    console.error("Error updating message templates:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: {}
    });
  }
};

// Helper function to get message template with variable replacement
export const getTemplateWithVariables = async (templateType, variables = {}) => {
  try {
    const templates = await MessageTemplates.findOne({ isActive: true });
    
    if (!templates) {
      throw new Error("No message templates found");
    }

    let template = templates[templateType];
    
    if (!template) {
      throw new Error(`Template type ${templateType} not found`);
    }

    // Replace variables in template
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      template = template.replace(regex, value || '');
    });

    return template;
  } catch (error) {
    console.error("Error getting template with variables:", error);
    throw error;
  }
};

