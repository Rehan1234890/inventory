const express = require("express");
const { authenticateToken, checkPermission } = require("../middleware/authmiddleware");
const db = require("../config/db");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Inventory
 *   description: API endpoints for managing inventory items
 */

/**
 * @swagger
 * /api/inventory/add:
 *   post:
 *     summary: Add a new inventory item
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - item_name
 *               - quantity
 *               - price
 *             properties:
 *               item_name:
 *                 type: string
 *               quantity:
 *                 type: integer
 *               price:
 *                 type: number
 *     responses:
 *       200:
 *         description: Item added successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Internal server error
 */
router.post("/add", authenticateToken, checkPermission("manage_inventory"), async (req, res) => {
    try {
        const { item_name, quantity, price } = req.body;
        if (!item_name || !quantity || !price) {
            return res.status(400).json({ message: "All fields are required" });
        }

        await db.execute("INSERT INTO inventory (item_name, quantity, price) VALUES (?, ?, ?)", 
            [item_name, quantity, price]);

        res.json({ message: "Item added successfully!" });
    } catch (error) {
        console.error("Error adding inventory:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * @swagger
 * /api/inventory/edit/{item_id}:
 *   put:
 *     summary: Edit an existing inventory item
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: item_id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               item_name:
 *                 type: string
 *               quantity:
 *                 type: integer
 *               price:
 *                 type: number
 *     responses:
 *       200:
 *         description: Item updated successfully
 *       404:
 *         description: Item not found
 *       500:
 *         description: Internal server error
 */
router.put("/edit/:item_id", authenticateToken, checkPermission("manage_inventory"), async (req, res) => {
    try {
        const { item_name, quantity, price } = req.body;
        const { item_id } = req.params;

        const [result] = await db.execute("UPDATE inventory SET item_name = ?, quantity = ?, price = ? WHERE item_id = ?", 
            [item_name, quantity, price, item_id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Item not found" });
        }

        res.json({ message: "Item updated successfully!" });
    } catch (error) {
        console.error("Error updating inventory:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * @swagger
 * /api/inventory:
 *   get:
 *     summary: Get all inventory items
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns a list of all inventory items
 *       500:
 *         description: Internal server error
 */
router.get("/", authenticateToken, async (req, res) => {
    try {
        const [items] = await db.execute("SELECT * FROM inventory");
        res.json(items);
    } catch (error) {
        console.error("Error fetching inventory:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * @swagger
 * /api/inventory/{item_id}:
 *   get:
 *     summary: Get a single inventory item
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: item_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Returns the requested inventory item
 *       404:
 *         description: Item not found
 *       500:
 *         description: Internal server error
 */
router.get("/:item_id", authenticateToken, async (req, res) => {
    try {
        const { item_id } = req.params;
        const [item] = await db.execute("SELECT * FROM inventory WHERE item_id = ?", [item_id]);

        if (item.length === 0) {
            return res.status(404).json({ message: "Item not found" });
        }

        res.json(item[0]);
    } catch (error) {
        console.error("Error fetching inventory item:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * @swagger
 * /api/inventory/delete/{item_id}:
 *   delete:
 *     summary: Delete an inventory item
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: item_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Item deleted successfully
 *       404:
 *         description: Item not found
 *       500:
 *         description: Internal server error
 */
router.delete('/delete/:item_id', authenticateToken, checkPermission("manage_inventory"), async (req, res) => {
    try {
        const { item_id } = req.params;
        const [result] = await db.execute('DELETE FROM inventory WHERE item_id = ?', [item_id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Item not found" });
        }

        res.json({ message: "Item deleted successfully" });
    } catch (error) {
        console.error("Error deleting inventory item:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

module.exports = router;
