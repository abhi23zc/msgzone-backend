import { Worker } from "bullmq";
import redisClient from "./redis.js";
import { sendOtpEmail } from "./sendEmail.js";
import 'dotenv/config';

export const emailWorker = new Worker(
  "email-queue",
  async (job) => {
    try {
      if (job?.data?.email && job?.data?.otp) {
        const { email, otp } = job.data;

        await sendOtpEmail(email, otp);
      }
    } catch (error) {
      console.error("Error processing email job:", error);
      throw error;
    }
  },
  { connection: redisClient }
);

emailWorker.on("completed", (job) => {
  console.log(`✅ Email Job completed: ${job.id}`);
});
emailWorker.on("failed", (job, err) => {
  console.log(`❌ Email Job failed: ${job.id}, Reason: ${err.message}`);
});
