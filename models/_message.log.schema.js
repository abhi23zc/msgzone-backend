import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["image", "video", "document", "audio"],
      required: true,
    },
    url: { type: String, required: true },
    name: String,
  },
  { _id: false }
);

const messageLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  sendFrom: { type: String, required: true },
  sendTo: { type: String, required: true },
  sendThrough: { type: String, enum:['api', 'app'], default:"app" },
  text: { type: String },
  attachments: [attachmentSchema],

  type: { type: String, enum: ["single", "bulk"], default: "single" },

  status: {
    type: String,
    enum: ["pending", "scheduled", "delivered", "error"],
    default: "delivered",
  },
  errorMessage: { type: String }, // if failed
  isScheduled: { type: Boolean, default: false },
  scheduledAt: { type: Date }, // for scheduled messages
  sentAt: { type: Date },

  createdAt: { type: Date, default: Date.now },
});

export const MessageLog = mongoose.model("MessageLog", messageLogSchema);
