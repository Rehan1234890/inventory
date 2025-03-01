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
 *           enum: [PENDING, APPROVED, REJECTED]
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
            sql = "SELECT r.id, u.name AS user, i.item_name, r.quantity, r.status FROM requests r JOIN users u ON r.user_id = u.id JOIN inventory i ON r.item_id = i.id";
        } else {
            sql = "SELECT r.id, i.item_name, r.quantity, r.status FROM requests r JOIN inventory i ON r.item_id = i.id WHERE r.user_id = ?";
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
 *                 enum: [APPROVED, REJECTED]
 *                 example: APPROVED
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
        const allowedStatuses = ["APPROVED", "REJECTED"];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid status. Allowed values: APPROVED, REJECTED" });
        }

        if (!["ADMIN", "MANAGER 1", "MANAGER 2"].includes(req.user.role)) {
            return res.status(403).json({ message: "Unauthorized to update request status" });
        }

        const [result] = await db.execute("UPDATE requests SET status = ? WHERE id = ?", [status, requestId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Request not found" });
        }

        res.json({ message: "Request updated successfully" });
    } catch (error) {
        console.error("Error updating request:", error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
