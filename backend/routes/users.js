const express = require("express");
const router = express.Router();
const pool = require("../config/database");

// GET /api/users - Get all users
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, userid, name, barangay, barangay_position, profile_pic FROM "users" ORDER BY name ASC'
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("GET /api/users error:", error);
    return res.status(500).json({ 
      message: "Failed to fetch users", 
      error: error.message 
    });
  }
});

// GET /api/users/barangay/:barangay - Get users by barangay
router.get("/barangay/:barangay", async (req, res) => {
  try {
    const { barangay } = req.params;
    
    const result = await pool.query(
      'SELECT id, userid, name, barangay, barangay_position, profile_pic FROM "users" WHERE barangay = $1 ORDER BY name ASC',
      [barangay]
    );
    
    return res.json(result.rows);
  } catch (error) {
    console.error("GET /api/users/barangay/:barangay error:", error);
    return res.status(500).json({ 
      message: "Failed to fetch users by barangay", 
      error: error.message 
    });
  }
});

// GET /api/users/:id - Get user by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate that id is a number
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    
    const result = await pool.query(
      'SELECT id, userid, name, barangay, barangay_position, profile_pic FROM "users" WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    return res.json(result.rows[0]);
  } catch (error) {
    console.error("GET /api/users/:id error:", error);
    return res.status(500).json({ 
      message: "Failed to fetch user", 
      error: error.message 
    });
  }
});

// PUT /api/users/:id - Update user profile
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, barangay, barangay_position, profile_pic } = req.body;
    
    // Validate that id is a number
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    
    const result = await pool.query(
      `UPDATE "users" 
       SET name = COALESCE($1, name), 
           barangay = COALESCE($2, barangay), 
           barangay_position = COALESCE($3, barangay_position), 
           profile_pic = COALESCE($4, profile_pic)
       WHERE id = $5 
       RETURNING id, userid, name, barangay, barangay_position, profile_pic`,
      [name, barangay, barangay_position, profile_pic, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    return res.json(result.rows[0]);
  } catch (error) {
    console.error("PUT /api/users/:id error:", error);
    return res.status(500).json({ 
      message: "Failed to update user", 
      error: error.message 
    });
  }
});

module.exports = router;
