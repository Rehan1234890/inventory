const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db'); // Ensure db connection is correctly imported
const router = express.Router();
const DEFAULT_PERMISSIONS = {
    ADMIN: { add_items: true, edit_items: true, delete_items: true, view_items: true, manage_users: true, approve_requests: true },
    "MANAGER 1": { add_items: true, edit_items: true, delete_items: false, view_items: true, manage_users: true, approve_requests: true },
    "MANAGER 2": { add_items: true, edit_items: true, delete_items: false, view_items: true, manage_users: false, approve_requests: true },
    "STORE KEEPER": { add_items: true, edit_items: false, delete_items: false, view_items: true, manage_users: false, approve_requests: false },
    EMPLOYEE: { add_items: false, edit_items: false, delete_items: false, view_items: true, manage_users: false, approve_requests: false }
};

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: Endpoints for user authentication
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
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
 *                 enum: [ADMIN, MANAGER 1, MANAGER 2, STORE KEEPER, EMPLOYEE]
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Bad request (Missing fields or user already exists)
 *       500:
 *         description: Internal server error
 */
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Check if the user already exists
        const [existingUser] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: "User already exists" });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user into the database
        const sql = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)";
        await db.execute(sql, [name, email, hashedPassword, role]);

        res.status(201).json({ message: "User registered successfully" });

    } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login a user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User logged in successfully, returns JWT token and role
 *       401:
 *         description: Unauthorized - Invalid email or password
 *       500:
 *         description: Internal server error
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        // Check if user exists
        const [user] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);

        if (user.length === 0) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // Compare hashed password
        const validPassword = await bcrypt.compare(password, user[0].password);
        if (!validPassword) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // Extract user details
        const userId = user[0].id; // Extracting user ID
        const role = user[0].role;

        // Generate JWT token
        const token = jwt.sign(
            { id: userId, role: role },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        // Send userId along with role and token
        res.status(200).json({ 
            message: "Login successful", 
            token, 
            role, 
            userId // Include userId in response
        });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});


/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get logged-in user details
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns user details (ID, name, email, role)
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: User not found
 */
router.get('/me', async (req, res) => {
  try {
      const token = req.headers.authorization?.split(" ")[1];

      if (!token) {
          return res.status(401).json({ message: "Unauthorized" });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const [user] = await db.execute("SELECT id, name, email, role FROM users WHERE id = ?", [decoded.id]);

      if (user.length === 0) {
          return res.status(404).json({ message: "User not found" });
      }

      res.json(user[0]);
  } catch (error) {
      console.error("Auth error:", error);
      res.status(401).json({ message: "Invalid token" });
  }
});

module.exports = router;
