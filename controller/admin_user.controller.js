import { MessageLog } from "../models/_message.log.schema.js";
import { User } from "../models/user.Schema.js";

export const getUserStats = async (req, res) => {
  try {
    const adminId = req?.user?.userId;
    const total = await User.countDocuments({ createdBy: adminId });
    const active = await User.countDocuments({ createdBy: adminId, isActive: true });
    const inactive = total - active;

    res.json({
      status: true,
      message: "User stats retrieved successfully",
      data: { total, active, inactive }
    });
  } catch (err) {
    console.log(err)
    res.status(500).json({
      status: false,
      message: "Failed to get user stats",
      data: null
    });
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
          whatsappNumber: user.whatsappNumber,
          password:user.password,
          role: user.role,
          isActive: user.isActive,
          isBlocked: user.isBlocked,
          isVerified: user.isVerified,
          role: user.role,
          devices : user.devices, //array of devices
          createdAt: user.createdAt,
          plan: {
            name: user.plan?.name || "Basic",
            expiresAt: user.plan?.expiresAt || "2025-12-31",
            limit: user.plan?.limit || 1000,
          },
          usage: {
            messagesSent: msgCount,
            messagesLimit: user.plan?.limit || 1000,
          },
        };
      })
    );

    res.json({
      status: true,
      message: "Users fetched successfully",
      data: withUsage
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      status: false,
      message: "Failed to fetch users",
      data: null
    });
  }
};

export const createUser = async (req, res) => {
  try {
    const adminId = req?.user?.userId;
    console.log(req.body)
    const { name, whatsappNumber, email, password } = req.body;

    if (!name || !whatsappNumber || !email || !password) {
      return res.status(400).json({
        status: false,
        message: "Please fill all required fields",
        data: null
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { whatsappNumber }],
    });

    if (existingUser) {
      return res.status(409).json({
        status: false,
        message: "User with this email or WhatsApp number already exists",
        data: null
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
      message: "User registered successfully",
      data: newUser
    });
  } catch (err) {
    console.log(err)
    res.status(500).json({
      status: false,
      message: "Failed to create user",
      data: null
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    const adminId = req?.user?.userId;
    const user = await User.findOne({ _id: req.params.id, createdBy: adminId });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found or unauthorized",
        data: null
      });
    }

    Object.assign(user, req.body);
    const updatedUser = await user.save();

    res.json({
      status: true,
      message: "User updated successfully",
      data: updatedUser
    });
  } catch (err) {
    console.log(err)
    res.status(500).json({
      status: false,
      message: "Failed to update user",
      data: null
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const adminId = req?.user?.userId;
    const user = await User.findOneAndDelete({ _id: req.params.id, createdBy: adminId });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found or unauthorized",
        data: null
      });
    }

    res.json({
      status: true,
      message: "User deleted successfully",
      data: null
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: "Failed to delete user",
      data: null
    });
  }
};
