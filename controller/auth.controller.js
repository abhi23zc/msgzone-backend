import { User } from "../models/user.Schema.js";
import jwt from "jsonwebtoken";
import { sendOtpEmail } from "../utils/sendEmail.js";
import { emailQueue } from "../utils/EmailQueue.js";

let NODE_ENV = process.env.NODE_ENV || "production";

// Domain configuration for production
const PRODUCTION_DOMAINS = [
  ".webifyit.in",
  ".msgzone.live",
];


function getDomainConfig(hostname) {
  if (NODE_ENV !== "production") {
    return {
      isProduction: false,
      domain: null,
      cookieOptions: {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      }
    };
  }

  const matchedDomain = PRODUCTION_DOMAINS.find(domain => hostname.endsWith(domain));
  
  if (matchedDomain) {
    return {
      isProduction: true,
      domain: matchedDomain,
      cookieOptions: {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        domain: matchedDomain,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      }
    };
  }

  return {
    isProduction: true,
    domain: PRODUCTION_DOMAINS[0],
    cookieOptions: {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      domain: PRODUCTION_DOMAINS[0],
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    }
  };
}


function setAuthCookie(res, token, hostname) {
  const config = getDomainConfig(hostname);
  res.cookie("token", token, config.cookieOptions);
}


function clearAuthCookie(res, hostname) {
  const config = getDomainConfig(hostname);
  const clearOptions = {
    ...config.cookieOptions,
    expires: new Date(0)
  };
  res.cookie("token", "", clearOptions);
}

function generateToken(user) {
  return jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET || "abhi@321",
    { expiresIn: "7d" }
  );
}

export const login = async (req, res) => {
  const { email, password } = req.body;

  const host = req.hostname;
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Please provide email and password.",
      data: null,
    });
  }

  try {
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
        data: null,
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account is blocked. Please contact support.",
        data: null,
      });
    }
    if (user.isVerified === false) {
      return res.status(401).json({
        success: false,
        message: "Please verify your email.",
        data: null,
      });
    }

    const isMatch = password == user.password;
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
        data: null,
      });
    }

    const token = generateToken(user);

    // Set cookie with dynamic domain configuration
    setAuthCookie(res, token, host);

    user.lastLogin = new Date();
    user.token = token;
    await user.save();

    const { password: _, ...userData } = user.toObject();
    return res.json({
      success: true,
      message: "Login successful.",
      data: { user: userData, token },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      data: null,
    });
  }
};

export const register = async (req, res) => {
  console.log("Register USER");

  const {
    name,
    businessName,
    whatsappNumber,
    alternateNumber,
    email,
    address,
    password,
  } = req.body;

  if (!name || !whatsappNumber || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Please fill all required fields.",
      data: null,
    });
  }

  try {
    const existingUser = await User.findOne({
      $or: [{ email }, { whatsappNumber }],
    });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email or WhatsApp number already exists.",
        data: null,
      });
    }
    const user = new User({
      name,
      businessName,
      whatsappNumber,
      alternateNumber,
      email,
      address,
      password,
    });

    await user.save();
    const { password: _, ...userData } = user.toObject();
    return res.status(201).json({
      success: true,
      message: "Registration successful.",
      data: { user: userData },
    });
  } catch (err) {
    console.error("Register error:", err);
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email or WhatsApp number already in use.",
        data: null,
      });
    }
    return res.status(500).json({
      success: false,
      message: "Server error.",
      data: null,
    });
  }
};

// Send OTP
export const sendOtp = async (req, res) => {
  const { email } = req.body;

  // return res.json({
  //   success: true,
  //   message: "OTP sent to your email.",
  //   data: null,
  // });

  if (!email)
    return res
      .status(400)
      .json({ success: false, message: "Email is required" });

  const user = await User.findOne({ email });
  if (!user)
    return res.status(404).json({ success: false, message: "User not found" });

  // Check if valid OTP already exists
  if (user.otp && user.otp.expiresAt > new Date()) {
    return res.status(400).json({
      success: false,
      message: `OTP already generated and valid for 10 minutes`,
    });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  user.otp = { code: otp, expiresAt };
  await user.save();

  try {
    await emailQueue.add(
      "email-queue",
      { email, otp, name: user.name },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 3000,
          removeOnComplete: true,
          removeOnFail: true,
        },
      }
    );
    return res.json({ success: true, message: "OTP sent to email." });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to send OTP" });
  }
};
// Verify OTP
export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  const user = await User.findOne({ email });
  if (!user || !user.otp || user.otp.code !== otp) {
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  if (new Date() > user.otp.expiresAt) {
    return res.status(400).json({ success: false, message: "OTP expired" });
  }
  user.isVerified = true;
  user.otp = undefined; // clear OTP
  await user.save();

  const token = generateToken(user);
  
  // Set cookie with dynamic domain configuration
  setAuthCookie(res, token, req.hostname);

  user.lastLogin = new Date();
  user.token = token;
  await user.save();

  const { password, ...userData } = user.toObject();
  return res.json({
    success: true,
    message: "OTP verified",
    data: { user: userData, token },
  });
};

export const profile = async (req, res) => {
  try {
    console.log("Fetching Profile");
    const userId = req?.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
        data: null,
      });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully.",
      data: { user },
    });
  } catch (err) {
    console.error("Profile error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      data: null,
    });
  }
};

export const logout = async (req, res) => {
  try {
    // Clear cookie with dynamic domain configuration
    clearAuthCookie(res, req.hostname);
    // If user exists in request, clear their token in DB
    if (req.user?.userId) {
      await User.findByIdAndUpdate(req.user.userId, {
        token: null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
      data: null,
    });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      data: null,
    });
  }
};

export const enable91 = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    // Toggle enableCode value

    user.enableCode = !user.enableCode;
    await user.save();

    if (user.enableCode) {
      return res.status(200).json({
        success: true,
        message: "91 enabled successfully.",
      });
    }
    return res.status(200).json({
      success: true,
      message: "91 disabled successfully.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: null,
    });
  }
};

// New forgot password controllers
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required",
      data: null
    });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        data: null
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.resetPasswordOtp = { code: otp, expiresAt };
    await user.save();

    // Send OTP via email
    await emailQueue.add(
      "email-queue",
      {
        email,
        otp,
        name: user.name,
        subject: "Password Reset OTP",
        message: `Your OTP for password reset is: ${otp}. Valid for 10 minutes.`
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 3000,
          removeOnComplete: true,
          removeOnFail: true,
        },
      }
    );

    return res.json({
      success: true,
      message: "Password reset OTP sent to your email"
    });

  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: null
    });
  }
};

export const verifyResetOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: "Email and OTP are required",
      data: null
    });
  }

  try {
    const user = await User.findOne({ email });

    if (!user || !user.resetPasswordOtp || user.resetPasswordOtp.code !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
        data: null
      });
    }

    if (new Date() > user.resetPasswordOtp.expiresAt) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired",
        data: null
      });
    }

    // Generate temporary token for password reset
    const resetToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || "abhi@321",
      { expiresIn: "15m" }
    );

    return res.json({
      success: true,
      message: "OTP verified successfully",
      data: { resetToken }
    });

  } catch (err) {
    console.error("Verify reset OTP error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: null
    });
  }
};

export const resetPassword = async (req, res) => {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Reset token and new password are required",
      data: null
    });
  }

  // Validate password strength
  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters long",
      data: null
    });
  }

  try {
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET || "abhi@321");
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        data: null
      });
    }

    // Update password and clear reset OTP
    user.password = newPassword;
    user.resetPasswordOtp = undefined;
    await user.save();

    return res.json({
      success: true,
      message: "Password reset successful",
      data: null
    });

  } catch (err) {
    console.error("Reset password error:", err);
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired reset token",
        data: null
      });
    }
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: null
    });
  }
};
