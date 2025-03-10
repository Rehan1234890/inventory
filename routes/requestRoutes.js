const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/authmiddleware");
const db = require("../config/db");

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *
 *   schemas:
 *     Request:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique ID of the request
 *         user_id:
 *           type: integer
 *           description: ID of the user making the request
 *         item_id:
 *           type: integer
 *           description: ID of the requested item
 *         quantity:
 *           type: integer
 *           description: Quantity requested
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, VERIFIED, HANDED OVER]
 *           description: Status of the request
 */

/**
 * @swagger
 * /api/requests:
 *   post:
 *     summary: Create a new inventory request
 *     security:
 *       - BearerAuth: []
 *     tags: [Requests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - itemId
 *               - quantity
 *             properties:
 *               itemId:
 *                 type: integer
 *                 example: 1
 *               quantity:
 *                 type: integer
 *                 example: 5
 *     responses:
 *       201:
 *         description: Request submitted successfully
 *       400:
 *         description: Bad request, missing fields
 *       500:
 *         description: Server error
 */
router.post("/", authenticateToken, async (req, res) => {
    try {
        const { itemId, quantity } = req.body;
        const userId = req.user.id;

        if (!itemId || !quantity) {
            return res.status(400).json({ message: "Item ID and quantity are required" });
        }

        const [result] = await db.execute(
            "INSERT INTO requests (user_id, item_id, quantity, status) VALUES (?, ?, ?, 'PENDING')",
            [userId, itemId, quantity]
        );

        res.status(201).json({ message: "Request submitted successfully", requestId: result.insertId });
    } catch (error) {
        console.error("Error submitting request:", error);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * @swagger
 * /api/requests:
 *   get:
 *     summary: Get inventory requests
 *     security:
 *       - BearerAuth: []
 *     tags: [Requests]
 *     responses:
 *       200:
 *         description: List of inventory requests
 *       500:
 *         description: Server error
 */
router.get("/", authenticateToken, async (req, res) => {
    try {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");

        let sql = "";
        let values = [];

        if (req.user.role === "ADMIN" || req.user.role.includes("MANAGER")) {
            sql = "SELECT r.id, u.name AS user, i.item_name, r.quantity, r.status FROM requests r JOIN users u ON r.user_id = u.id JOIN inventory i ON r.item_id = i.item_id";
        } else {
            sql = "SELECT r.id, i.item_name, r.quantity, r.status FROM requests r JOIN inventory i ON r.item_id = i.item_id WHERE r.user_id = ?";
            values = [req.user.id];
        }

        const [requests] = await db.execute(sql, values);
        res.json(requests);
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * @swagger
 * /api/requests/{id}:
 *   put:
 *     summary: Update the status of an inventory request
 *     security:
 *       - BearerAuth: []
 *     tags: [Requests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the request to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [verified, approved, rejected]
 *                 example: approved
 *     responses:
 *       200:
 *         description: Request updated successfully
 *       400:
 *         description: Invalid request data
 *       403:
 *         description: Unauthorized action
 *       404:
 *         description: Request not found
 *       500:
 *         description: Server error
 */
router.put("/:id", authenticateToken, async (req, res) => {
    try {
        const { status } = req.body;
        const requestId = req.params.id;
        const newStatus = status.toLowerCase(); // Ensure case-insensitive comparison

        const allowedTransitions = {
            "pending": ["verified1", "rejected"],
            "verified1": ["verified2", "rejected"],
            "verified2": ["approved", "rejected"],
            "approved": ["handed over"]
        };

        // Fetch current status from DB
        const [rows] = await db.execute("SELECT LOWER(status) as status FROM requests WHERE id = ?", [requestId]);
        if (rows.length === 0) return res.status(404).json({ message: "Request not found" });

        const currentStatus = rows[0].status;

        console.log(`Updating request #${requestId}: ${currentStatus} → ${newStatus}`);

        // Ensure valid status transitions
        if (!allowedTransitions[currentStatus] || !allowedTransitions[currentStatus].includes(newStatus)) {
            return res.status(400).json({ message: `Invalid transition from ${currentStatus} to ${newStatus}` });
        }

        // Role-based validation
        const role = req.user.role;
        if ((newStatus === "verified1" && role !== "MANAGER 1") ||
            (newStatus === "verified2" && role !== "MANAGER 2") ||
            (newStatus === "approved" && role !== "ADMIN")) {
            return res.status(403).json({ message: `Unauthorized: Only ${role} can update to ${newStatus}` });
        }

        // Update request status in DB
        const [result] = await db.execute("UPDATE requests SET status = ? WHERE id = ?", [newStatus, requestId]);

        if (result.affectedRows === 0) {
            console.error(`No rows updated for request #${requestId}`);
            return res.status(404).json({ message: "Request not found or already updated" });
        }

        console.log(`✅ Request #${requestId} successfully updated to ${newStatus}`);
        res.json({ message: `Request updated to ${newStatus} successfully` });

    } catch (error) {
        console.error("❌ Error updating request:", error);
        res.status(500).json({ message: "Server error" });
    }
});


/**
 * @swagger
 * /api/requests/approved-requests:
 *   get:
 *     summary: Get all approved requests
 *     tags: [Requests]
 *     responses:
 *       200:
 *         description: List of approved requests
 *       500:
 *         description: Database error
 */
router.get("/approved-requests", authenticateToken, async (req, res) => {
    try {
        const sql = `
            SELECT r.id, u.name AS user_name, i.item_name, r.quantity, r.status 
            FROM requests r
            LEFT JOIN users u ON r.user_id = u.id
            JOIN inventory i ON r.item_id = i.item_id
            WHERE r.status = 'approved'
        `;

        const [rows] = await db.execute(sql);

        console.log("Approved Requests:", rows); // Debugging output

        res.json(rows);
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ error: "Database Error" });
    }
});


/**
 * @swagger
 * /api/requests/handover:
 *   post:
 *     summary: Handover an approved request and update inventory
 *     tags: [Requests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requestId
 *               - itemId
 *               - quantity
 *             properties:
 *               requestId:
 *                 type: integer
 *               itemId:
 *                 type: integer
 *               quantity:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Item handed over successfully
 *       500:
 *         description: Database update failed
 */
router.post("/handover", authenticateToken, async (req, res) => {
    const connection = await db.getConnection();

    try {
        console.log("Handover Request Body:", req.body); // Debugging log

        const { requestId, quantity } = req.body;

        if (!requestId || !quantity) {
            console.error("Missing Data:", { requestId, quantity });
            return res.status(400).json({ message: "Missing required fields: requestId, quantity" });
        }

        await connection.beginTransaction();

        // 🛠️ Fetch itemId and item_name from the requests and inventory tables
        const [requestResult] = await connection.execute(
            `SELECT r.item_id, i.item_name 
             FROM requests r 
             JOIN inventory i ON r.item_id = i.item_id 
             WHERE r.id = ?`,
            [requestId]
        );

        if (requestResult.length === 0) {
            return res.status(404).json({ message: "Request not found" });
        }

        const { item_id: itemId, item_name: itemName } = requestResult[0];
        console.log(`Resolved itemId: ${itemId}, itemName: ${itemName} for requestId: ${requestId}`);

        // 🛠️ Check if inventory has enough stock
        const [inventory] = await connection.execute("SELECT * FROM inventory WHERE item_id = ?", [itemId]);
        if (inventory.length === 0) {
            return res.status(404).json({ message: "Item not found in inventory" });
        }

        if (inventory[0].quantity < quantity) {
            return res.status(400).json({ message: "Not enough stock available" });
        }

        // 🛠️ Update request status
        await connection.execute("UPDATE requests SET status = 'HANDED OVER' WHERE id = ?", [requestId]);

        // 🛠️ Deduct quantity from inventory
        await connection.execute("UPDATE inventory SET quantity = quantity - ? WHERE item_id = ?", [quantity, itemId]);

        await connection.commit();

        res.json({ 
            success: true, 
            message: "Item handed over successfully.", 
            requestDetails: { requestId, itemId, itemName, quantity },
            itemDetails: inventory[0] 
        });

    } catch (err) {
        await connection.rollback();
        console.error("Database update error:", err);
        res.status(500).json({ error: "Database Update Failed" });
    } finally {
        connection.release();
    }
});



module.exports = router;
