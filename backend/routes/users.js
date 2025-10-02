const express = require("express");
const router = express.Router();
const { supabaseAdmin } = require("../config/supabase");

// GET /api/users - Get all users
router.get("/", async (req, res) => {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, userid, name, barangay, barangay_position, profile_pic')
      .order('name', { ascending: true });
      
    if (error) {
      throw error;
    }
    
    return res.json(users);
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
    
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, userid, name, barangay, barangay_position, profile_pic')
      .eq('barangay', barangay)
      .order('name', { ascending: true });
      
    if (error) {
      throw error;
    }
    
    return res.json(users);
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
    
    // Validate that id is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }
    
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, userid, name, barangay, barangay_position, profile_pic')
      .eq('id', id)
      .single();
      
    if (error || !user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    return res.json(user);
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
    
    // Validate that id is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }
    
    // Build update object with only provided fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (barangay !== undefined) updateData.barangay = barangay;
    if (barangay_position !== undefined) updateData.barangay_position = barangay_position;
    if (profile_pic !== undefined) updateData.profile_pic = profile_pic;
    
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('id, userid, name, barangay, barangay_position, profile_pic')
      .single();
      
    if (error || !user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    return res.json(user);
  } catch (error) {
    console.error("PUT /api/users/:id error:", error);
    return res.status(500).json({ 
      message: "Failed to update user", 
      error: error.message 
    });
  }
});

module.exports = router;
