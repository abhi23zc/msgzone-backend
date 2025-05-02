import jwt from "jsonwebtoken";

export const isAuthenticated = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token provided, authorization denied." });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "abhi@321");
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Token is not valid." });
    }
};
