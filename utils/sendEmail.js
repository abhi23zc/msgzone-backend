import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const sendOtpEmail = async (email, otp, name = "User") => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL ||  "abhishek.singh.dev147@gmail.com",
      pass: process.env.PASS || "ckdz wzif ojkz pczi",
    },
  });

  // Email template variables
  const templateVars = {
    userName: name,
    userFirstName: name.split(' ')[0] || name,
    otpCode: otp,
    companyName: "MSGZone",
    companyEmail: process.env.EMAIL || "abhishek.singh.dev147@gmail.com",
    supportEmail: "support@msgzone.com",
    currentYear: new Date().getFullYear(),
    logoUrl: "https://msgzone.com/logo.png",
    primaryColor: "#2563eb",
    secondaryColor: "#1d4ed8",
    accentColor: "#3b82f6",
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
        <title>Verify Your Account - ${templateVars.companyName}</title>
      </head>
      <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f8fafc;line-height:1.5;">
        <div style="max-width:600px;margin:0 auto;background-color:#ffffff;">
          
          <!-- Header -->
          <div style="background-color:#1e293b;padding:32px 24px;text-align:center;">
            <div style="display:inline-block;background-color:#3b82f6;padding:12px 20px;border-radius:8px;margin-bottom:16px;">
              <span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:0.5px;">${templateVars.companyName}</span>
            </div>
            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;">Account Verification Required</h1>
          </div>

          <!-- Main Content -->
          <div style="padding:40px 32px;">
            
            <!-- Greeting -->
            <div style="margin-bottom:32px;">
              <h2 style="color:#0f172a;font-size:20px;font-weight:600;margin:0 0 16px;">Hello ${templateVars.userFirstName},</h2>
              <p style="color:#475569;font-size:16px;margin:0;line-height:1.6;">
                Thank you for creating your ${templateVars.companyName} account. To complete your registration and secure your account, please verify your email address using the code below.
              </p>
            </div>

            <!-- Verification Code -->
            <div style="background-color:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px;padding:32px;text-align:center;margin:32px 0;">
              <p style="color:#64748b;font-size:14px;margin:0 0 16px;font-weight:500;text-transform:uppercase;letter-spacing:1px;">Verification Code</p>
              <div style="background-color:#ffffff;border:2px solid #3b82f6;border-radius:8px;padding:20px;display:inline-block;margin:0 0 16px;">
                <span style="color:#1e40af;font-size:32px;font-weight:700;letter-spacing:4px;font-family:'SF Mono',Monaco,'Cascadia Code','Roboto Mono',Consolas,'Courier New',monospace;">${templateVars.otpCode}</span>
              </div>
              <p style="color:#64748b;font-size:14px;margin:0;font-weight:500;">Valid for ${templateVars.otpExpiryMinutes} minutes</p>
            </div>

            <!-- Instructions -->
            <div style="background-color:#fefce8;border-left:4px solid #eab308;padding:20px;border-radius:0 8px 8px 0;margin:32px 0;">
              <h3 style="color:#a16207;font-size:16px;font-weight:600;margin:0 0 8px;">Important Security Information</h3>
              <ul style="color:#a16207;font-size:14px;margin:0;padding-left:20px;">
                <li style="margin-bottom:4px;">This code is confidential and should not be shared</li>
                <li style="margin-bottom:4px;">${templateVars.companyName} will never ask for this code via phone or email</li>
                <li>If you didn't request this verification, please ignore this email</li>
              </ul>
            </div>

            <!-- Next Steps -->
            <div style="margin:32px 0;">
              <h3 style="color:#0f172a;font-size:16px;font-weight:600;margin:0 0 12px;">What's Next?</h3>
              <ol style="color:#475569;font-size:15px;margin:0;padding-left:20px;">
                <li style="margin-bottom:8px;">Enter the verification code above in your browser</li>
                <li style="margin-bottom:8px;">Complete your account setup</li>
                <li>Start using ${templateVars.companyName} services</li>
              </ol>
            </div>

            <!-- Support -->
            <div style="border-top:1px solid #e2e8f0;padding-top:24px;margin-top:32px;">
              <p style="color:#64748b;font-size:14px;margin:0 0 8px;">
                Need help? Contact our support team at 
                <a href="mailto:${templateVars.supportEmail}" style="color:#3b82f6;text-decoration:none;font-weight:500;">${templateVars.supportEmail}</a>
              </p>
              <p style="color:#94a3b8;font-size:13px;margin:0;">
                This email was sent to ${email} because you requested account verification.
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
    subject: `Verify your ${templateVars.companyName} account - ${templateVars.otpCode}`,
    html,
  });
};
