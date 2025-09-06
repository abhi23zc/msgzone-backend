import crypto from "crypto";
import Razorpay from "razorpay";
import { User } from "../models/user.Schema.js";
import { Plan } from "../models/plan.schema.js";
import { Payment } from "../models/payment.schema.js";
import { configDotenv } from "dotenv";
configDotenv();

const assignPlanToUser = async (req, res, userId, planId) => {
  try {

    const plan = await Plan.findById(planId);
    if (!plan || plan.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Plan not found or inactive",
        data: {},
      });
    }

    const user = await User.findById(userId).populate("subscriptions.plan");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        data: {},
      });
    }

    const hasActive = user.subscriptions?.some((sub) => sub.isActive);

    const now = new Date();
    const end = new Date(
      now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000
    );

    const subscriptionData = {
      plan: plan._id,
      startDate: hasActive ? null : now,
      endDate: hasActive ? null : end,
      isActive: !hasActive,
      status: hasActive ? "inactive" : "active",
      usedMessages: 0,
      deviceIds: [],
    };

    user.subscriptions.push(subscriptionData);
    await user.save();

    return res.json({
      success: true,
      message: hasActive
        ? "Plan added to queue and will activate later"
        : "Plan assigned and activated successfully",
      data: { user },
    });
  } catch (error) {
    console.error("Assign Plan Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      data: {},
    });
  }
};


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_HQ4tZ6kBqnghIu",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "MfDx0p5Ngmqb2G9Vk4GZeSMe",
});
// POST /create-order
export const createRazorpayOrder = async (req, res) => {
  const { planId } = req.body;

  try {
    const plan = await Plan.findById(planId);
    if (!plan || plan.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
        data: {},
      });
    }

    const order = await razorpay.orders.create({
      amount: plan.price * 100,
      currency: plan.currency || "INR",
      receipt: `receipt_${Date.now()}`,
    });

    return res.status(200).json({
      success: true,
      message: "Order created successfully",
      data: {
        orderId: order.id,
        paymentId: null,
        razorpay_signature: null,
        amount: order.amount,
        currency: order.currency,
      },
    });
  } catch (err) {
    console.error("Error creating Razorpay order:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: {},
    });
  }
};
// POST /verify-payment
export const verifyPayment = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } =
    req.body;
  console.log("Payment Details", req.body);
  const userId = req.user?.userId;

  try {
    // Verify Razorpay signature
    const hmac = crypto.createHmac(
      "sha256",
      process.env.RAZORPAY_KEY_SECRET || "MfDx0p5Ngmqb2G9Vk4GZeSMe"
    );
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
        data: {},
      });
    }

    // Save payment record
    await Payment.create({
      paymentMode: "razorpay",
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      user: userId,
      plan: planId,
      status: "approved", // Razorpay payments are auto-approved
    });

    // Find plan
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res
        .status(404)
        .json({ success: false, message: "Plan not found" });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const hasActive = user.subscriptions?.some((sub) => sub.isActive);

    const now = new Date();
    const end = new Date(
      now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000
    );

    const newSubscription = {
      plan: plan._id,
      startDate: hasActive ? null : now,
      endDate: hasActive ? null : end,
      usedMessages: 0,
      deviceIds: [],
      status: hasActive ? "inactive" : "active",
      isActive: !hasActive,
    };

    // Push to subscriptions array
    user.subscriptions.push(newSubscription);
    await user.save();

    return res.status(200).json({
      success: true,
      message: hasActive
        ? "Payment Succeeded"
        : "Payment verified. Plan activated successfully.",
      data: null,
    });
  } catch (err) {
    console.error("Payment verification error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: {},
    });
  }
};
// GET /admin/payments
export const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate("user", "name email")
      .populate("plan", "name price durationDays");

    return res.status(200).json({
      success: true,
      message: "Payments retrieved successfully",
      data: { payments },
    });
  } catch (err) {
    console.error("Get payments error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: {},
    });
  }
};

// GET /user/payments
export const getUserPayments = async (req, res) => {
  const userId = req.user?.userId;
  const BASE_URL = `${req.protocol}://${req.get('host')}`;

  try {
    const payments = await Payment.find({ user: userId })
      .populate("plan", "name price durationDays")
      .populate("user", "name email")
      .sort({ date: -1 }) // Changed from createdAt to date per schema
      .select({
        razorpay_order_id: 1,
        razorpay_payment_id: 1,
        razorpay_signature: 1, // Added signature field from schema
        paymentMode: 1,
        paymentMethod: 1, // Added paymentMethod field
        bankDetails: 1, // Added bankDetails field
        status: 1,
        utrNumber: 1,
        screenshotUrl: 1,
        date: 1, // Changed from createdAt to date per schema
      });

    // Debug: Log payment data to see what fields are available
    console.log("Raw payment data from DB:", payments[0]);
    
    return res.status(200).json({
      success: true,
      message: "User payments retrieved successfully",
      data: {
        payments: payments.map((payment) => ({
          id: payment._id,
          orderId:
            payment.paymentMode === "razorpay"
              ? payment.razorpay_order_id
              : null,
          paymentId:
            payment.paymentMode === "razorpay"
              ? payment.razorpay_payment_id
              : null,
          signature:
            payment.paymentMode === "razorpay"
              ? payment.razorpay_signature
              : null,
          mode: payment.paymentMode,
          paymentMethod: payment.paymentMethod, // Added paymentMethod field
          bankDetails: payment.bankDetails, // Added bankDetails field
          status: payment.status,
          utrNumber:
            payment.paymentMode === "manual" ? payment.utrNumber : null,
          screenshot:
            payment.paymentMode === "manual" ? BASE_URL + "/" + payment.screenshotUrl : null,
          date: payment.date,
          plan: payment.plan,
          user: payment.user,
        })),
      },
    });
  } catch (err) {
    console.error("Get user payments error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: {},
    });
  }
};

import { sendNotification } from "./_whatsapp.controller.js"; // Make sure the path is correct
import { PaymentSettings } from "../models/paymentSettings.schema.js";

// Manual Payment
export const createManualPayment = async (req, res) => {
  const planId = req?.body?.planId;
  const utrNumber = req?.body?.utrNumber;
  const paymentMethod = req?.body?.paymentMethod || 'qr'; // Default to QR if not provided
  const screenshot = req?.file?.path;
  
  // Debug: Log the received data
  console.log("createManualPayment - Received data:", {
    planId,
    utrNumber,
    paymentMethod,
    hasScreenshot: !!screenshot
  });
  
  if (!planId || !utrNumber) {
    return res.status(400).json({
      success: false,
      message: "Plan ID and UTR number are required",
      data: {},
    });
  }

  const userId = req.user?.userId;

  try {
    const plan = await Plan.findById(planId);
    const user = await User.findById(userId);
    const admin = await User.findOne({"role":"admin"});
    
    // Fetch payment settings to get bank details
    const paymentSettings = await PaymentSettings.findOne({ isActive: true });
    const bankDetails = paymentSettings?.bankDetails || null;

    if (!plan || plan.status !== "active") {
      return res
        .status(404)
        .json({ success: false, message: "Plan not found" });
    }

    if (plan.name == "Free Tier") {
      const freeTierPayment = await Payment.create({
        paymentMode: "manual",
        utrNumber: utrNumber || "",
        screenshotUrl: screenshot || "",
        paymentMethod: paymentMethod,
        bankDetails: paymentMethod === 'bank' ? bankDetails : null,
        user: userId,
        plan: planId,
        status: "approved",
      });
      
      // Debug: Log the Free Tier payment data
      console.log("createManualPayment - Free Tier payment created:", {
        id: freeTierPayment._id,
        paymentMethod: freeTierPayment.paymentMethod,
        bankDetails: freeTierPayment.bankDetails,
        utrNumber: freeTierPayment.utrNumber
      });

      // Send detailed notification for Free Tier auto-approval
      const freeTierMessage = `🎉 *Payment Approved!*

Hello ${user?.name || 'User'},

Your payment for the *Free Tier* plan has been auto-approved successfully!

📋 *Plan Details:*
• Plan: Free Tier
• Duration: ${plan.durationDays} days
• Messages: ${plan.messageLimit || "Unlimited"} messages
• Status: ✅ Active

Your subscription is now active and you can start sending messages immediately.

Thank you for choosing MsgZone! 🚀

Best regards,
MsgZone Team`;

      await sendNotification(admin?.adminDevice, userId, freeTierMessage);

      assignPlanToUser(req, res, userId, planId);
      return;
    }

    const createdPayment = await Payment.create({
      paymentMode: "manual",
      utrNumber,
      screenshotUrl: screenshot || "",
      paymentMethod: paymentMethod,
      bankDetails: paymentMethod === 'bank' ? bankDetails : null,
      user: userId,
      plan: planId,
      status: "pending",
    });
    
    // Debug: Log the created payment data
    console.log("createManualPayment - Created payment:", {
      id: createdPayment._id,
      paymentMethod: createdPayment.paymentMethod,
      bankDetails: createdPayment.bankDetails,
      utrNumber: createdPayment.utrNumber
    });

    // Send detailed notification for pending payment
    const paymentMethodText = paymentMethod === 'bank' ? 'Bank Transfer (NEFT/RTGS)' : 'QR Code & UPI';
    const bankInfoText = paymentMethod === 'bank' && bankDetails ? 
      `\n🏦 *Bank Details:*
• Account Holder: ${bankDetails.accountHolderName}
• Bank: ${bankDetails.bankName}
• Account: ${bankDetails.accountNumber}
• IFSC: ${bankDetails.ifscCode}
• Branch: ${bankDetails.branchName}` : '';

    const pendingMessage = `⏳ *Payment Under Review*

Hello ${user?.name || 'User'},

Your payment of ₹${plan.price} for the *${plan.name}* plan has been received and is currently under review.

📋 *Payment Details:*
• Amount: ₹${plan.price}
• Plan: ${plan.name}
• Payment Method: ${paymentMethodText}
• UTR: ${utrNumber}
• Status: 🔍 Pending Review${bankInfoText}

📋 *Plan Details:*
• Duration: ${plan.durationDays} days
• Messages: ${plan.messageLimit || "Unlimited"} messages
• Features: ${plan.features?.join(', ') || 'Standard features'}

Our team will review your payment and activate your plan within 24 hours. You will receive a confirmation message once approved.

Thank you for your patience!

Best regards,
MsgZone Team`;

    await sendNotification(admin?.adminDevice, userId, pendingMessage);

    return res.status(200).json({
      success: true,
      message: "Manual payment submitted. Waiting for admin approval.",
    });
  } catch (err) {
    console.error("Manual payment error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// PUT /admin/approve-payment/:paymentId
export const approveManualPayment = async (req, res) => {
  const { paymentId } = req.params;
  
  try {
    const payment = await Payment.findById(paymentId).populate("user plan");
    const admin = await User.findOne({"role":"admin"});

    
    if (!payment || payment.paymentMode !== "manual") {
      return res
        .status(404)
        .json({ success: false, message: "Manual payment not found" });
    }

    if (payment.status === "approved") {
      return res
        .status(400)
        .json({ success: false, message: "Payment already approved" });
    }

    const user = payment.user;
    const plan = payment.plan;

    const hasActive = user.subscriptions?.some((sub) => sub.isActive);
    const now = new Date();
    const end = new Date(
      now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000
    );

    const newSubscription = {
      plan: plan._id,
      startDate: hasActive ? null : now,
      endDate: hasActive ? null : end,
      usedMessages: 0,
      deviceIds: [],
      status: hasActive ? "inactive" : "active",
      isActive: !hasActive,
    };

    console.log(newSubscription)

    user.subscriptions.push(newSubscription);
    await user.save();

    payment.status = "approved";
    await payment.save();

    // Send detailed approval notification
    const paymentMethodText = payment.paymentMethod === 'bank' ? 'Bank Transfer (NEFT/RTGS)' : 'QR Code & UPI';
    const bankInfoText = payment.paymentMethod === 'bank' && payment.bankDetails ? 
      `\n🏦 *Bank Details:*
• Account Holder: ${payment.bankDetails.accountHolderName}
• Bank: ${payment.bankDetails.bankName}
• Account: ${payment.bankDetails.accountNumber}
• IFSC: ${payment.bankDetails.ifscCode}
• Branch: ${payment.bankDetails.branchName}` : '';

    const approvalMessage = `🎉 *Payment Approved!*

Hello ${user?.name || 'User'},

Your payment of ₹${plan.price} for the *${plan.name}* plan has been approved successfully!

📋 *Payment Details:*
• Amount: ₹${plan.price}
• Plan: ${plan.name}
• Payment Method: ${paymentMethodText}
• UTR: ${payment.utrNumber}
• Status: ✅ Approved
• Approved At: ${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}${bankInfoText}

📋 *Plan Details:*
• Duration: ${plan.durationDays} days
• Messages: ${plan.messageLimit || "Unlimited"} messages
• Features: ${plan.features?.join(', ') || 'Standard features'}
• Start Date: ${now.toLocaleDateString('en-IN')}
• End Date: ${end.toLocaleDateString('en-IN')}

🚀 *What's Next:*
• Your subscription is now active
• You can start sending messages immediately
• Access all premium features
• Track your usage in the dashboard

Thank you for choosing MsgZone! 

Need help? Contact our support team anytime.

Best regards,
MsgZone Team`;

    await sendNotification(admin?.adminDevice, user._id, approvalMessage);

    return res.status(200).json({
      success: true,
      message: "Manual payment approved and plan activated.",
    });
  } catch (err) {
    console.error("Approve payment error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// PUT /admin/reject-payment/:paymentId
export const rejectManualPayment = async (req, res) => {
  const { paymentId } = req.params;

  try {
    const payment = await Payment.findById(paymentId).populate("user plan");
    const admin = await User.findOne({"role":"admin"});

    if (!payment || payment.paymentMode !== "manual") {
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });
    }

    const user = payment.user;
    const plan = payment.plan;

    payment.status = "rejected";
    await payment.save();

    // Send detailed rejection notification
    const rejectionMessage = `❌ *Payment Rejected*

Hello ${user?.name || 'User'},

We regret to inform you that your payment of ₹${plan.price} for the *${plan.name}* plan has been rejected.

📋 *Payment Details:*
• Amount: ₹${plan.price}
• Plan: ${plan.name}
• UTR: ${payment.utrNumber}
• Status: ❌ Rejected
• Rejected At: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}

*Reason:* Payment verification failed

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
MsgZone Team`;

    await sendNotification(admin?.adminDevice, user._id, rejectionMessage);

    return res.status(200).json({
      success: true,
      message: "Manual payment rejected.",
    });
  } catch (err) {
    console.error("Reject payment error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /admin/payments-stats
export const getPaymentsStats = async (req, res) => {
  try {
    // Get all payments with their status counts
    const [payments, paymentStats] = await Promise.all([
      Payment.find()
        .populate("user", "name email")
        .populate("plan", "name price durationDays deviceLimit messageLimit")
        .sort({ date: -1 }),
      Payment.aggregate([
        {
          $group: {
            _id: null,
            totalPayments: { $sum: 1 },
            razorpayPayments: {
              $sum: { $cond: [{ $eq: ["$paymentMode", "razorpay"] }, 1, 0] }
            },
            manualPayments: {
              $sum: { $cond: [{ $eq: ["$paymentMode", "manual"] }, 1, 0] }
            },
            approvedPayments: {
              $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] }
            },
            pendingPayments: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
            },
            rejectedPayments: {
              $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] }
            },
            totalAmount: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "approved"] },
                  { $toDouble: "$plan.price" },
                  0
                ]
              }
            }
          }
        }
      ])
    ]);

    // Format payment stats
    const stats = paymentStats[0] || {
      totalPayments: 0,
      razorpayPayments: 0,
      manualPayments: 0,
      approvedPayments: 0,
      pendingPayments: 0,
      rejectedPayments: 0,
      totalAmount: 0
    };
    const BASE_URL = `${req.protocol}://${req.get('host')}`;

    return res.status(200).json({
      success: true,
      message: "All payments retrieved successfully",
      data: {
        payments: payments.map(payment => ({
          id: payment._id,
          user: payment.user,
          plan: payment.plan,
          paymentMode: payment.paymentMode,
          paymentMethod: payment.paymentMethod, // Added paymentMethod field
          bankDetails: payment.bankDetails, // Added bankDetails field
          status: payment.status,
          // Razorpay specific fields
          razorpay_order_id: payment.paymentMode === "razorpay" ? payment.razorpay_order_id : null,
          razorpay_payment_id: payment.paymentMode === "razorpay" ? payment.razorpay_payment_id : null,
          razorpay_signature: payment.paymentMode === "razorpay" ? payment.razorpay_signature : null,
          // Manual payment specific fields
          utrNumber: payment.paymentMode === "manual" ? payment.utrNumber : null,
          screenshotUrl: payment.paymentMode === "manual" ? BASE_URL + "/" + payment.screenshotUrl : null,
          date: payment.date
        })),
        stats: {
          total: stats.totalPayments,
          razorpay: stats.razorpayPayments,
          manual: stats.manualPayments,
          approved: stats.approvedPayments,
          pending: stats.pendingPayments,
          rejected: stats.rejectedPayments,
          totalAmount: stats.totalAmount
        }
      }
    });
  } catch (err) {
    console.error("Error fetching payments:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: {}
    });
  }
};
