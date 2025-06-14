import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const sendOtpEmail = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL ||  "abhishek.singh.dev147@gmail.com",
      pass: process.env.PASS || "ckdz wzif ojkz pczi",
    },
  });

  const html = `
    <html>
      <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background-color:#f8f9fa;">
        <div style="max-width:600px;margin:0 auto;padding:20px;">
          <!-- Header -->
          <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
            // <img src="https://msgzone.com/logo.png" alt="MSGZone Logo" style="width:120px;height:auto;margin-bottom:15px;">
            <h1 style="color:white;margin:0;font-size:24px;font-weight:600;">Secure Verification</h1>
          </div>

          <!-- Main Content -->
          <div style="background:white;padding:40px 30px;border-radius:0 0 12px 12px;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
            <p style="color:#1f2937;font-size:16px;line-height:1.6;margin-bottom:25px;">
              Hello there! 👋<br>
              Welcome to MSGZONE! To verify your account and keep it secure, please use this verification code:
            </p>

            <div style="background:#f3f4f6;padding:20px;border-radius:8px;text-align:center;margin:30px 0;">
              <p style="color:#4b5563;font-size:14px;margin:0 0 10px;">Your verification code is:</p>
              <h2 style="color:#2563eb;font-size:32px;letter-spacing:8px;margin:0;font-weight:600;">${otp}</h2>
            </div>

            <p style="color:#6b7280;font-size:14px;line-height:1.5;margin-bottom:30px;">
              This code will expire in 10 minutes. For security reasons, please do not share this code with anyone.
            </p>

            <div style="border-top:1px solid #e5e7eb;padding-top:20px;margin-top:30px;">
              <p style="color:#6b7280;font-size:13px;text-align:center;margin:0;">
                If you didn't request this code, please ignore this email or contact our support team.
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
    subject: "🔐 Your MSGZONE Verification Code",
    html,
  });
};
