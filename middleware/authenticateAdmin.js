export const isAdmin = (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ status:false, data:null, message: "Authentication required" });
        }

        // Check if user has admin role
        if (req.user.role !== 'admin') {
            return res.status(403).json({ status:false, data:null , message: "Admin access required" });
        }

        next();
    } catch (error) {
        return res.status(500).json({ status:false,data:null, message: "Server error" });
    }
}
