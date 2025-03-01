const jwt = require("jsonwebtoken");
const db = require("../config/db");

// 🔐 Middleware to authenticate user via JWT
exports.authenticateToken = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
        if (err) return res.status(403).json({ message: "Invalid token" });

        try {
            // ✅ Fetch user permissions based on role, not user_id
            const [rows] = await db.execute(
                "SELECT manage_users, view_reports, manage_inventory, approve_requests, request_items FROM permissions WHERE role = ?",
                [user.role]
            );

            if (rows.length === 0) {
                return res.status(403).json({ message: "No permissions assigned for this role" });
            }

            // ✅ Attach user and permissions to request object
            req.user = { ...user, permissions: rows[0] }; // Store as an object
            next();
        } catch (error) {
            console.error("Error fetching permissions:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    });
};

// 🔒 Middleware to check if user is Admin
exports.isAdmin = (req, res, next) => {
    if (req.user.role !== "ADMIN") {
        return res.status(403).json({ message: "Access denied. Admins only." });
    }
    next();
};

// 🛑 Middleware to check specific permissions
exports.checkPermission = (permission) => (req, res, next) => {
    const userPermissions = req.user.permissions;

    // ✅ Allow all users to view inventory
    if (req.method === "GET") {
        return next();
    }

    // ✅ Check if the user has the required permission
    if (!userPermissions[permission] || userPermissions[permission] !== 1) {
        return res.status(403).json({ message: "Access denied. You don't have the required permission." });
    }

    next();
};
