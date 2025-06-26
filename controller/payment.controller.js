import crypto from "crypto";
import Razorpay from "razorpay";
import { User } from "../models/user.Schema.js";
import { Plan } from "../models/plan.schema.js";
import { Payment } from "../models/payment.schema.js";
import { configDotenv } from "dotenv";
configDotenv();

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
        amount: order?.currency == "INR" ? order?.amount * 100 : order?.amount,
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
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      user: userId,
      plan: planId,
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
      isActive: !hasActive,
    };

    // Push to subscriptions array
    user.subscriptions.push(newSubscription);
    await user.save();

    return res.status(200).json({
      success: true,
      message: hasActive
        ? "Payment Succeded"
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
