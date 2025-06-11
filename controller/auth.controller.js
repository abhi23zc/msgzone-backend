import { User } from "../models/user.Schema.js";
import jwt from "jsonwebtoken";
import { sendOtpEmail } from "../utils/sendEmail.js";
import { emailQueue } from "../utils/EmailQueue.js";

function generateToken(user) {
  return jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET || "abhi@321",
    { expiresIn: "7d" }
  );
}

export const login = async (req, res) => {
  const { email, password } = req.body;

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

    // ✅ For production
    // res.cookie("token", token, {
    //   httpOnly: true,
    //   secure: true,
    //   sameSite: "none",
    //   domain: ".webifyit.in", // ⬅️ This allows sharing across all subdomains
    //   maxAge: 7 * 24 * 60 * 60 * 1000,
    //   path: "/",
    // });

    // ☑️ For development
    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // NO secure on localhost HTTP
      sameSite: "lax", // Use "lax" or "strict", but NOT "none" for localhost HTTP
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

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
      { email, otp },
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
  // ✅ For production
  // res.cookie("token", token, {
  //   httpOnly: true,
  //   secure: true,
  //   sameSite: "none",
  //   domain: ".webifyit.in", // ⬅️ This allows sharing across all subdomains
  //   maxAge: 7 * 24 * 60 * 60 * 1000,
  //   path: "/",
  // });

  // ☑️ For development
  res.cookie("token", token, {
    httpOnly: true,
    secure: false, // NO secure on localhost HTTP
    sameSite: "lax", // Use "lax" or "strict", but NOT "none" for localhost HTTP
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  });

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
    // ☑️ For Development
    res.cookie("token", "", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      expires: new Date(0), // Immediately expire the cookie
    });

    // ✅ For Production
    // res.cookie("token", "", {
    //   httpOnly: true,
    //   secure: true,
    //   sameSite: "none",
    //   domain: ".webifyit.in",
    //   path: "/",
    //   expires: new Date(0)
    // });

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
