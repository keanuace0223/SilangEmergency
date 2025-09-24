const express = require("express");
const router = express.Router();

// TODO: Wire these handlers to PostgreSQL when your schema is ready

// GET /api/reports
router.get("/", async (_req, res) => {
  try {
    // Placeholder response
    return res.json([]);
  } catch (error) {
    console.error("GET /api/reports error:", error);
    return res.status(500).json({ message: "Failed to fetch reports" });
  }
});

// POST /api/reports
router.post("/", async (req, res) => {
  try {
    const { title, description } = req.body || {};
    if (!title || !description) {
      return res.status(400).json({ message: "title and description are required" });
    }

    // Placeholder created report
    const created = {
      id: Date.now(),
      title,
      description,
      createdAt: new Date().toISOString(),
    };

    return res.status(201).json(created);
  } catch (error) {
    console.error("POST /api/reports error:", error);
    return res.status(500).json({ message: "Failed to create report" });
  }
});

module.exports = router;


