import { Worker } from "bullmq";
import redisClient from "./redis.js";
import { sendOtpEmail } from "./sendEmail.js";
import 'dotenv/config';

// Create and start the email worker automatically
const emailWorker = new Worker(
  "email-queue",
  async (job) => {
    try {
      const { email, otp, name, subject, message } = job.data;

      if (email && otp) {
        // If subject and message are provided, it's a password reset email
        if (subject && message) {
          await sendPasswordResetEmail(email, otp, name, subject, message);
        } else {
          // Default OTP verification email
          await sendOtpEmail(email, otp, name);
        }
      }
    } catch (error) {
      console.error("Error processing email job:", error);
      throw error;
    }
  },
  { 
    connection: redisClient,
    concurrency: 5, // Process up to 5 emails concurrently
    removeOnComplete: 10, // Keep only 10 completed jobs
    removeOnFail: 50, // Keep 50 failed jobs for debugging
  }
);

// Export the worker instance
export { emailWorker };

// Function to send password reset emails
const sendPasswordResetEmail = async (email, otp, name = "User", subject, message) => {
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.default.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL || "abhishek.singh.dev147@gmail.com",
      pass: process.env.PASS || "ckdz wzif ojkz pczi",
    },
  });

  // Template variables for password reset email
  const templateVars = {
    userName: name,
    userFirstName: name.split(' ')[0] || name,
    otpCode: otp,
    companyName: "MSGZone",
    companyEmail: process.env.EMAIL || "abhishek.singh.dev147@gmail.com",
    supportEmail: "support@msgzone.com",
    currentYear: new Date().getFullYear(),
    primaryColor: "#dc2626",
    secondaryColor: "#b91c1c",
    accentColor: "#ef4444",
    textColor: "#1f2937",
    lightTextColor: "#6b7280",
    backgroundColor: "#f8f9fa",
    cardBackground: "#ffffff",
    borderColor: "#e5e7eb",
    otpExpiryMinutes: 10
  };

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - ${templateVars.companyName}</title>
      </head>
      <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f8fafc;line-height:1.5;">
        <div style="max-width:600px;margin:0 auto;background-color:#ffffff;">
          
          <!-- Header -->
          <div style="background-color:#dc2626;padding:32px 24px;text-align:center;">
            <div style="display:inline-block;background-color:#ffffff;padding:12px 20px;border-radius:8px;margin-bottom:16px;">
              <span style="color:#dc2626;font-size:18px;font-weight:600;letter-spacing:0.5px;">${templateVars.companyName}</span>
            </div>
            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;">Password Reset Request</h1>
          </div>

          <!-- Main Content -->
          <div style="padding:40px 32px;">
            
            <!-- Greeting -->
            <div style="margin-bottom:32px;">
              <h2 style="color:#0f172a;font-size:20px;font-weight:600;margin:0 0 16px;">Hello ${templateVars.userFirstName},</h2>
              <p style="color:#475569;font-size:16px;margin:0;line-height:1.6;">
                We received a request to reset the password for your ${templateVars.companyName} account. If you made this request, use the verification code below to proceed with resetting your password.
              </p>
            </div>

            <!-- Reset Code -->
            <div style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:32px;text-align:center;margin:32px 0;">
              <p style="color:#dc2626;font-size:14px;margin:0 0 16px;font-weight:500;text-transform:uppercase;letter-spacing:1px;">Password Reset Code</p>
              <div style="background-color:#ffffff;border:2px solid #dc2626;border-radius:8px;padding:20px;display:inline-block;margin:0 0 16px;">
                <span style="color:#b91c1c;font-size:32px;font-weight:700;letter-spacing:4px;font-family:'SF Mono',Monaco,'Cascadia Code','Roboto Mono',Consolas,'Courier New',monospace;">${templateVars.otpCode}</span>
              </div>
              <p style="color:#dc2626;font-size:14px;margin:0;font-weight:500;">Valid for ${templateVars.otpExpiryMinutes} minutes</p>
            </div>

            <!-- Security Notice -->
            <div style="background-color:#fef3c7;border-left:4px solid #eab308;padding:20px;border-radius:0 8px 8px 0;margin:32px 0;">
              <h3 style="color:#a16207;font-size:16px;font-weight:600;margin:0 0 8px;">Security Alert</h3>
              <ul style="color:#a16207;font-size:14px;margin:0;padding-left:20px;">
                <li style="margin-bottom:4px;">This code is confidential and should not be shared with anyone</li>
                <li style="margin-bottom:4px;">${templateVars.companyName} will never ask for this code via phone or email</li>
                <li>If you didn't request this password reset, please ignore this email</li>
              </ul>
            </div>

            <!-- Next Steps -->
            <div style="margin:32px 0;">
              <h3 style="color:#0f172a;font-size:16px;font-weight:600;margin:0 0 12px;">Complete Your Password Reset</h3>
              <ol style="color:#475569;font-size:15px;margin:0;padding-left:20px;">
                <li style="margin-bottom:8px;">Enter the reset code above in your browser</li>
                <li style="margin-bottom:8px;">Create a new, secure password</li>
                <li>Sign in to your account with your new password</li>
              </ol>
            </div>

            <!-- Support -->
            <div style="border-top:1px solid #e2e8f0;padding-top:24px;margin-top:32px;">
              <p style="color:#64748b;font-size:14px;margin:0 0 8px;">
                Need assistance? Contact our support team at 
                <a href="mailto:${templateVars.supportEmail}" style="color:#dc2626;text-decoration:none;font-weight:500;">${templateVars.supportEmail}</a>
              </p>
              <p style="color:#94a3b8;font-size:13px;margin:0;">
                This email was sent to ${email} because you requested a password reset.
              </p>
            </div>

          </div>

          <!-- Footer -->
          <div style="background-color:#f8fafc;padding:24px 32px;border-top:1px solid #e2e8f0;">
            <div style="text-align:center;margin-bottom:16px;">
              <p style="color:#64748b;font-size:13px;margin:0;">
                © ${templateVars.currentYear} ${templateVars.companyName}. All rights reserved.
              </p>
            </div>
            <div style="text-align:center;">
              <a href="#" style="color:#64748b;text-decoration:none;font-size:12px;margin:0 12px;">Privacy Policy</a>
              <a href="#" style="color:#64748b;text-decoration:none;font-size:12px;margin:0 12px;">Terms of Service</a>
              <a href="#" style="color:#64748b;text-decoration:none;font-size:12px;margin:0 12px;">Unsubscribe</a>
            </div>
          </div>

        </div>
      </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"${templateVars.companyName} Security" <${templateVars.companyEmail}>`,
    to: email,
    subject: subject || `Reset your ${templateVars.companyName} password - ${templateVars.otpCode}`,
    html,
  });
};

// Set up event listeners for the email worker
emailWorker.on("completed", (job) => {
  console.log(`✅ Email Job completed: ${job.id}`);
});

emailWorker.on("failed", (job, err) => {
  console.log(`❌ Email Job failed: ${job.id}, Reason: ${err.message}`);
});

emailWorker.on("ready", () => {
  console.log("📧 Email worker is ready and listening for jobs");
});

emailWorker.on("error", (err) => {
  console.error("❌ Email worker error:", err);
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down email worker...');
  await emailWorker.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down email worker...');
  await emailWorker.close();
  process.exit(0);
});

// Log that the email worker is starting
console.log("🚀 Email worker initialized and ready to process jobs");
