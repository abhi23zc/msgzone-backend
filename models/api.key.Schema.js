import mongoose from "mongoose";

const ApiKeySchema = new mongoose.Schema({
  apiKey: { type: String, required: true, unique: true },
  deviceId: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }, 
  status: { type: String, enum: ["active", "inactive"], default: "active" },
});

export const ApiKey = mongoose.model("ApiKey", ApiKeySchema);
