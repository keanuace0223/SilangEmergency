const express = require("express");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const router = express.Router();

// DB connection (shared by router handlers)
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "SilangEmergency",
  password: "kenpogi0223",
  port: 5432,
});

// Login route mounted by parent app at /api/auth
router.post("/login", async (req, res) => {
  const { userID, password } = req.body;

  try {
    // Check if user exists
    const result = await pool.query(
      'SELECT * FROM "users" WHERE "userid" = $1 LIMIT 1',
      [userID]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid userID or password" });
    }

    const user = result.rows[0];

    // Plain text password check (testing only). Replace with bcrypt in production.
    if (password !== user.password) {
      return res.status(401).json({ error: "Invalid userID or password" });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, userID: user.userid },
      "supersecretkey", // use process.env.JWT_SECRET in real apps
      { expiresIn: "1h" }
    );

    // Send token + user info
    res.json({
      token,
      user: {
        id: user.id,
        userID: user.userid,
        name: user.name,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
