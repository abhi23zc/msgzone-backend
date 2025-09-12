import mongoose from "mongoose";

const messageTemplatesSchema = new mongoose.Schema({
  paymentApproval: {
    type: String,
    required: true,
    default: `🎉 *Payment Approved!*

Hello {{userName}},

Your payment of ₹{{amount}} for the *{{planName}}* plan has been approved successfully!

📋 *Payment Details:*
• Amount: ₹{{amount}}
• Plan: {{planName}}
• Payment Method: {{paymentMethod}}
• UTR: {{utrNumber}}
• Status: ✅ Approved
• Approved At: {{approvedAt}}

📋 *Plan Details:*
• Duration: {{durationDays}} days
• Messages: {{messageLimit}} messages
• Features: {{features}}
• Start Date: {{startDate}}
• End Date: {{endDate}}

🚀 *What's Next:*
• Your subscription is now active
• You can start sending messages immediately
• Access all premium features
• Track your usage in the dashboard

Thank you for choosing MsgZone! 

Need help? Contact our support team anytime.

Best regards,
MsgZone Team`
  },
  paymentRejection: {
    type: String,
    required: true,
    default: `❌ *Payment Rejected*

Hello {{userName}},

We regret to inform you that your payment of ₹{{amount}} for the *{{planName}}* plan has been rejected.

📋 *Payment Details:*
• Amount: ₹{{amount}}
• Plan: {{planName}}
• UTR: {{utrNumber}}
• Status: ❌ Rejected
• Rejected At: {{rejectedAt}}

*Reason:* {{rejectionReason}}

🔄 *What's Next:*
• Please verify your payment details
• Ensure UTR number is correct
• Check if payment was successful
• Contact support if you believe this is an error

💡 *Need Help?*
• Contact our support team
• Resubmit payment with correct details
• Check our payment guidelines

We're here to help you get started!

Best regards,
MsgZone Team`
  },
  paymentPending: {
    type: String,
    required: true,
    default: `⏳ *Payment Under Review*

Hello {{userName}},

Your payment of ₹{{amount}} for the *{{planName}}* plan has been received and is currently under review.

📋 *Payment Details:*
• Amount: ₹{{amount}}
• Plan: {{planName}}
• Payment Method: {{paymentMethod}}
• UTR: {{utrNumber}}
• Status: 🔍 Pending Review

📋 *Plan Details:*
• Duration: {{durationDays}} days
• Messages: {{messageLimit}} messages
• Features: {{features}}

Our team will review your payment and activate your plan within 24 hours. You will receive a confirmation message once approved.

Thank you for your patience!

Best regards,
MsgZone Team`
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Ensure only one active template set exists
messageTemplatesSchema.index({ isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

export const MessageTemplates = mongoose.model("MessageTemplates", messageTemplatesSchema);

