const express = require("express");
const router = express.Router();
const { supabaseAdmin } = require("../config/supabase");
const { isValidUUID } = require("../utils/validation");

// GET /api/reports
router.get("/", async (req, res) => {
  try {
    // Get user_id from query parameter
    const userId = req.query.user_id;
    
    if (!userId) {
      return res.status(400).json({ message: "user_id parameter is required" });
    }
    
    const isUUID = isValidUUID(userId);
    
    let reports;
    
    if (isUUID) {
      // Direct UUID lookup
      const { data, error } = await supabaseAdmin
        .from('reports')
        .select('*')
        .eq('user_id', userId)
        .order('incident_datetime', { ascending: false });
        
      if (error) {
        throw error;
      }
      reports = data;
    } else {
      // Lookup by userid string - need to find the user first
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('userid', userId)
        .single();
        
      if (userError || !userData) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const { data, error } = await supabaseAdmin
        .from('reports')
        .select('*')
        .eq('user_id', userData.id)
        .order('incident_datetime', { ascending: false });
        
      if (error) {
        throw error;
      }
      reports = data;
    }
    
    return res.json(reports);
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
    
    const isUUID = isValidUUID(userId);
    
    let actualUserId = userId;
    
    if (!isUUID) {
      // Lookup by userid string - need to find the user first
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('userid', userId)
        .single();
        
      if (userError || !userData) {
        return res.status(404).json({ message: "User not found" });
      }
      
      actualUserId = userData.id;
    }
    
    const { count, error } = await supabaseAdmin
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', actualUserId);
      
    if (error) {
      throw error;
    }
    
    return res.json({ 
      count: count || 0,
      userId: userId
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
      userId
    } = req.body;

    // Validate required fields
    if (!incidentType || !location || !urgency || !description || !userId) {
      return res.status(400).json({ 
        message: "incidentType, location, urgency, description, and userId are required" 
      });
    }

    // Validate urgency value
    if (!['Low', 'Moderate', 'High'].includes(urgency)) {
      return res.status(400).json({ 
        message: "urgency must be one of: Low, Moderate, High" 
      });
    }

    // Insert new report into Supabase
    const { data: createdReport, error } = await supabaseAdmin
      .from('reports')
      .insert({
        user_id: userId,
        incident_type: incidentType,
        location: location,
        urgency_tag: urgency,
        description: description,
        uploaded_media: mediaUrls
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.status(201).json(createdReport);
  } catch (error) {
    console.error("POST /api/reports error:", error);
    return res.status(500).json({ 
      message: "Failed to create report",
      error: error.message 
    });
  }
});

module.exports = router;


