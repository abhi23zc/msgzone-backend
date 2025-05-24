import jwt from "jsonwebtoken";

export const isAuthenticated = (req, res, next) => {

    console.log("request.....")
    let token = req.cookies?.token;
    if (!token) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "No token provided, authorization denied.",
                data: null
            });
        }
        token = authHeader.split(" ")[1];
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "abhi@321");
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: "Token is not valid. Please login...",
            data: null
        });
    }
};