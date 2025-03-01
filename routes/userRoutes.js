const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { authenticateToken, checkPermission } = require("../middleware/authmiddleware");
const db = require("../config/db"); // ✅ Import database

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: API endpoints for user management
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns a list of users
 *       500:
 *         description: Internal Server Error
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const [users] = await db.execute("SELECT id, name, email, role FROM users");
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Internal Server Error
 */
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.execute(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name, email, hashedPassword, role]
    );

    res.status(201).json({ message: "User created successfully!" });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal Server Error
 */
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;

    // Check if user exists
    const [user] = await db.execute("SELECT * FROM users WHERE id = ?", [userId]);
    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete user
    await db.execute("DELETE FROM users WHERE id = ?", [userId]);

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update user role
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *     responses:
 *       200:
 *         description: User role updated successfully
 *       400:
 *         description: Role is required
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal Server Error
 */
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ message: "Role is required" });
    }

    // Check if user exists
    const [user] = await db.execute("SELECT * FROM users WHERE id = ?", [userId]);
    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update user role
    await db.execute("UPDATE users SET role = ? WHERE id = ?", [role, userId]);

    res.json({ message: "User role updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ✅ Role-based access control routes

/**
 * @swagger
 * /api/users/admin:
 *   get:
 *     summary: Admin-only access
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Welcome, Admin
 */
router.get("/admin", checkPermission(["ADMIN"]), (req, res) => {
  res.json({ message: "Welcome, Admin" });
});

/**
 * @swagger
 * /api/users/manager1:
 *   get:
 *     summary: Manager 1 access
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Welcome, Manager 1
 */
router.get("/manager1", checkPermission(["ADMIN", "MANAGER 1"]), (req, res) => {
  res.json({ message: "Welcome, Manager 1" });
});

/**
 * @swagger
 * /api/users/manager2:
 *   get:
 *     summary: Manager 2 access
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Welcome, Manager 2
 */
router.get("/manager2", checkPermission(["ADMIN", "MANAGER 2"]), (req, res) => {
  res.json({ message: "Welcome, Manager 2" });
});

/**
 * @swagger
 * /api/users/storekeeper:
 *   get:
 *     summary: Store Keeper access
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Welcome, Store Keeper
 */
router.get("/storekeeper", checkPermission(["ADMIN", "STORE KEEPER"]), (req, res) => {
  res.json({ message: "Welcome, Store Keeper" });
});

/**
 * @swagger
 * /api/users/employee:
 *   get:
 *     summary: Employee access
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Welcome, Employee
 */
router.get("/employee", checkPermission(["ADMIN", "EMPLOYEE"]), (req, res) => {
  res.json({ message: "Welcome, Employee" });
});

module.exports = router;
