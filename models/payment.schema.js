import mongoose from "mongoose";
const PaymentSchema = new mongoose.Schema({
  paymentMode: {
    type: String,
    enum: ["razorpay", "manual"],
    required: true,
  },
  razorpay_order_id: String,
  razorpay_payment_id: String,
  razorpay_signature: String,

  utrNumber: String,
  screenshotUrl: String,
  paymentMethod: {
    type: String,
    enum: ["qr", "bank"],
    default: "qr",
  },
  bankDetails: {
    accountHolderName: String,
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    branchName: String,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Plan",
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

export const Payment = mongoose.model("Payment", PaymentSchema);
