import { User } from "../models/user.Schema.js";
import jwt from 'jsonwebtoken'
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
        return res.status(400).json({ message: "Please provide email and password." });
    }

    try {
        const user = await User.findOne({ email }).select("+password");
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        if (user.isBlocked) {
            return res.status(403).json({ message: "Your account is blocked. Please contact support." });
        }

        const isMatch = (password == user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        const token = generateToken(user);
    
        user.lastLogin = new Date();
        await user.save();

        const { password: _, ...userData } = user.toObject();
        res.json({ user: userData, token });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "Server error." });
    }
}

export const register = async (req, res) => {
    console.log("Register USER")

    const {
        name,
        businessName,
        whatsappNumber,
        alternateNumber,
        email,
        address,
        password
    } = req.body;

    if (!name || !businessName || !whatsappNumber || !email || !password) {
        return res.status(400).json({ message: "Please fill all required fields." });
    }

    try {
        const existingUser = await User.findOne({ $or: [{ email }, { whatsappNumber }] });
        if (existingUser) {
            return res.status(409).json({ message: "User with this email or WhatsApp number already exists." });
        }
        const user = new User({
            name,
            businessName,
            whatsappNumber,
            alternateNumber,
            email,
            address,
            password
        });

        await user.save();

        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET || "abhi@321",
            { expiresIn: "7d" }
        );

        const { password: _, ...userData } = user.toObject();
        res.status(201).json({ user: userData, token });
    } catch (err) {
        console.error("Register error:", err);
        if (err.code === 11000) {
            return res.status(409).json({ message: "Email or WhatsApp number already in use." });
        }
        res.status(500).json({ message: "Server error." });
    }
}

export const profile = async (req, res) => {
    try {
        const userId = req?.user?.userId
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const user = await User.findById(userId).select("-password");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({ user });
    } catch (err) {
        console.error("Profile error:", err);
        res.status(500).json({ message: "Server error." });
    }
};
