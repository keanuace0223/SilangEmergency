const express = require("express");
const { Pool } = require("pg");
const router = express.Router();

// Database connection pool
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "SilangEmergency",
  password: "kenpogi0223",
  port: 5432,
});

// GET /api/reports
router.get("/", async (req, res) => {
  try {
    // Get user_id from query parameter (for now, we'll use a default user)
    const userId = req.query.user_id || 1; // Default to user_id = 1 for now
    
    const result = await pool.query(
      "SELECT * FROM reports WHERE user_id = $1 ORDER BY incident_datetime DESC",
      [userId]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("GET /api/reports error:", error);
    return res.status(500).json({ 
      message: "Failed to fetch reports", 
      error: error.message 
    });
  }
});

// GET /api/reports/count/:userId
router.get("/count/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(
      "SELECT COUNT(*) as count FROM reports WHERE user_id = $1",
      [userId]
    );
    
    return res.json({ 
      count: parseInt(result.rows[0].count),
      userId: parseInt(userId)
    });
  } catch (error) {
    console.error("GET /api/reports/count error:", error);
    return res.status(500).json({ 
      message: "Failed to fetch report count", 
      error: error.message 
    });
  }
});

// POST /api/reports
router.post("/", async (req, res) => {
  try {
    const { 
      incidentType, 
      location, 
      urgency, 
      description, 
      mediaUrls = [],
      userId = 1 // Default to user_id = 1 for now
    } = req.body;

    // Validate required fields
    if (!incidentType || !location || !urgency || !description) {
      return res.status(400).json({ 
        message: "incidentType, location, urgency, and description are required" 
      });
    }

    // Insert new report into database using your actual schema
    const result = await pool.query(
      `INSERT INTO reports (user_id, incident_type, location, urgency_tag, description, uploaded_media, incident_datetime) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) 
       RETURNING *`,
      [userId, incidentType, location, urgency, description, mediaUrls]
    );

    const createdReport = result.rows[0];
    return res.status(201).json(createdReport);
  } catch (error) {
    console.error("POST /api/reports error:", error);
    return res.status(500).json({ message: "Failed to create report" });
  }
});

module.exports = router;


