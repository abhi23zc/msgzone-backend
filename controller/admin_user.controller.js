import { MessageLog } from "../models/_message.log.schema.js";
import { User } from "../models/user.Schema.js";

export const getUserStats = async (req, res) => {
  try {
    const total = await User.countDocuments({ role: "user" });
    const active = await User.countDocuments({ role: "user", isActive: true });
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
    const users = await User.find({ role: "user" })
      .populate('subscriptions.plan')


    const formattedUsers = await Promise.all(
      users.map(async (user) => {
        const messagesSent = await MessageLog.countDocuments({ userId: user._id });
        
        // Get active subscription if exists
        const activeSubscription = user.subscriptions?.find(sub => sub.status === "active");

        return {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.whatsappNumber,
          businessName: user.businessName,
          alternateNumber: user.alternateNumber,
          address: user.address,
          role: user.role,
          isActive: user.isActive,
          isBlocked: user.isBlocked,
          isVerified: user.isVerified,
          profilePhoto: user.profilePhoto,
          devices: user.devices.map(device => ({
            deviceId: device.deviceId,
            number: device.number,
            status: device.status,
            lastConnected: device.lastConnected
          })),
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
          plan: activeSubscription ? {
            name: activeSubscription.plan?.name || 'Default',
            startDate: activeSubscription.startDate,
            expiresAt: activeSubscription.endDate,
            deviceIds: activeSubscription.deviceIds,
            usedMessages: activeSubscription.usedMessages
          } : null,
          usage: {
            messagesSent,
            messagesLimit: activeSubscription?.plan?.messageLimit || 0
          }
        };
      })
    );

    res.json({
      status: true,
      message: "Users fetched successfully",
      data: formattedUsers
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
    const { name, whatsappNumber, email, password, businessName } = req.body;

    if (!name || !whatsappNumber || !email || !password) {
      return res.status(400).json({
        status: false,
        message: "Please fill all required fields",
        data: null
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { whatsappNumber }],
      role: "user"
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
      role: "user",
      isVerified: true,
      createdBy: req.user._id
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
    const user = await User.findOne({ _id: req.params.id, role: "user" });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
        data: null
      });
    }

    // Prevent role modification
    delete req.body.role;
    
    Object.assign(user, req.body);
    const updatedUser = await user.save();

    const { password: _, ...userData } = updatedUser.toObject();

    res.json({
      status: true,
      message: "User updated successfully",
      data: userData
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
    const user = await User.findOneAndDelete({ 
      _id: req.params.id,
      role: "user"
    });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
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
