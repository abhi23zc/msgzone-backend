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
      <body style="background:#f5f5f5;padding:20px;font-family:sans-serif;">
        <div style="background:white;padding:20px;border-radius:8px;max-width:500px;margin:auto;">
          <h2 style="color:#2c3e50;text-align:center;">Your OTP Code</h2>
          <p style="text-align:center;font-size:18px;">Use the following OTP to continue:</p>
          <h1 style="text-align:center;letter-spacing:10px;color:#007bff;">${otp}</h1>
          <p style="text-align:center;color:#888;">This OTP is valid for 10 minutes.</p>
        </div>
      </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"MSGZone Service" <${process.env.EMAIL}>`,
    to: email,
    subject: "Your One-Time Password (OTP)",
    html,
  });
};
