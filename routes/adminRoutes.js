const express = require("express");
const db = require("../config/db");
const { authenticateToken, isAdmin } = require("../middleware/authmiddleware");
const router = express.Router();

// Admin updates role permissions
router.put("/update-permissions", authenticateToken, isAdmin, async (req, res) => {
    try {
        const { role, permissions } = req.body; // Permissions should be an object with add_items, edit_items, etc.

        await db.execute(
            "UPDATE permissions SET add_items = ?, edit_items = ?, delete_items = ?, view_items = ?, manage_users = ?, approve_requests = ? WHERE role = ?",
            [
                permissions.add_items,
                permissions.edit_items,
                permissions.delete_items,
                permissions.view_items,
                permissions.manage_users,
                permissions.approve_requests,
                role,
            ]
        );

        res.json({ message: "Permissions updated successfully!" });
    } catch (error) {
        console.error("Error updating permissions:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

module.exports = router;
