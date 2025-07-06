import { Worker } from "bullmq";
import redisClient from "./redis.js";
import { sendOtpEmail } from "./sendEmail.js";
import 'dotenv/config';

export const emailWorker = new Worker(
  "email-queue",
  async (job) => {
    try {
      const { email, otp, subject, message } = job.data;

      if (email && otp) {
        // If subject and message are provided, it's a password reset email
        if (subject && message) {
          await sendPasswordResetEmail(email, otp, subject, message);
        } else {
          // Default OTP verification email
          await sendOtpEmail(email, otp);
        }
      }
    } catch (error) {
      console.error("Error processing email job:", error);
      throw error;
    }
  },
  { connection: redisClient }
);

// Function to send password reset emails
const sendPasswordResetEmail = async (email, otp, subject, message) => {
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.default.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL || "abhishek.singh.dev147@gmail.com",
      pass: process.env.PASS || "ckdz wzif ojkz pczi",
    },
  });

  const html = `
    <html>
      <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background-color:#f8f9fa;">
        <div style="max-width:600px;margin:0 auto;padding:20px;">
          <!-- Header -->
          <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="color:white;margin:0;font-size:24px;font-weight:600;">Password Reset</h1>
          </div>

          <!-- Main Content -->
          <div style="background:white;padding:40px 30px;border-radius:0 0 12px 12px;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
            <p style="color:#1f2937;font-size:16px;line-height:1.6;margin-bottom:25px;">
              Hello! 👋<br>
              We received a request to reset your password. Use the code below to complete the process:
            </p>

            <div style="background:#fef2f2;padding:20px;border-radius:8px;text-align:center;margin:30px 0;border:1px solid #fecaca;">
              <p style="color:#dc2626;font-size:14px;margin:0 0 10px;font-weight:600;">Your password reset code is:</p>
              <h2 style="color:#dc2626;font-size:32px;letter-spacing:8px;margin:0;font-weight:600;">${otp}</h2>
            </div>

            <p style="color:#6b7280;font-size:14px;line-height:1.5;margin-bottom:30px;">
              This code will expire in 10 minutes. If you didn't request this password reset, please ignore this email.
            </p>

            <div style="border-top:1px solid #e5e7eb;padding-top:20px;margin-top:30px;">
              <p style="color:#6b7280;font-size:13px;text-align:center;margin:0;">
                For security reasons, please do not share this code with anyone.
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div style="text-align:center;padding:20px;color:#6b7280;font-size:12px;">
            <p style="margin:0;">© 2025 MSGZone. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"MSG-ZONE Security" <${process.env.EMAIL}>`,
    to: email,
    subject: subject || "🔐 Password Reset Code",
    html,
  });
};

emailWorker.on("completed", (job) => {
  console.log(`✅ Email Job completed: ${job.id}`);
});
emailWorker.on("failed", (job, err) => {
  console.log(`❌ Email Job failed: ${job.id}, Reason: ${err.message}`);
});
