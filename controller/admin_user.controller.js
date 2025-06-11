import { MessageLog } from "../models/_message.log.schema.js";
import { User } from "../models/user.Schema.js";


export const getUserStats = async (req, res) => {
  try {
    const adminId = req?.user?.userId;
    const total = await User.countDocuments({ createdBy: adminId });
    const active = await User.countDocuments({ createdBy: adminId, isActive: true });
    const inactive = total - active;

    res.json({
      total,
      active,
      inactive,
    });
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: "Failed to get user stats" });
  }
};


export const getAllUsers = async (req, res) => {
  try {
    const adminId = req?.user?.userId;

    const users = await User.find({ createdBy: adminId }).lean();

    const withUsage = await Promise.all(
      users.map(async (user) => {
        const msgCount = await MessageLog.countDocuments({ userId: user._id });

        return {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.whatsappNumber,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          plan: {
            name: user.plan?.name || "Basic",
            expiresAt: user.plan?.expiresAt || "2025-12-31", // Dummy for now
            limit: user.plan?.limit || 1000,
          },
          usage: {
            messagesSent: msgCount,
            messagesLimit: user.plan?.limit || 1000,
          },
        };
      })
    );

    res.json(withUsage);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};


export const createUser = async (req, res) => {
  try {
    const adminId = req?.user?.userId;
    const { name, whatsappNumber, email, password } = req.body;

    if (!name || !whatsappNumber || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields.",
        data: null,
      });
    }

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

    const user = await User.create({
      ...req.body,
      isVerified: true,
      createdBy: adminId,
    });

    const { password: _, ...newUser } = user.toObject();

    res.status(201).json({
      status: true,
      data: newUser,
      message: "User Registered Successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      data: null,
      error: "Failed to create user",
    });
  }
};


export const updateUser = async (req, res) => {
  try {
    const adminId = req?.user?.userId;
    const user = await User.findOne({ _id: req.params.id, createdBy: adminId });

    if (!user) {
      return res.status(404).json({ error: "User not found or unauthorized" });
    }

    Object.assign(user, req.body);
    const updatedUser = await user.save();

    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: "Failed to update user" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const adminId = req?.user?.userId;
    const user = await User.findOneAndDelete({ _id: req.params.id, createdBy: adminId });

    if (!user) {
      return res.status(404).json({ error: "User not found or unauthorized" });
    }

    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete user" });
  }
};
