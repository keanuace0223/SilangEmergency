const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const router = express.Router();
const { supabaseAdmin } = require("../config/supabase");
const config = require("../config/config");

// Login route mounted by parent app at /api/auth
router.post("/login", async (req, res) => {
  const { userID, password } = req.body;

  try {
    // Check if user exists in Supabase
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('userid', userID)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: "Invalid userID or password" });
    }

    // Check password (support both plain text and hashed passwords during migration)
    let passwordValid = false;
    
    if (user.password_hash) {
      // Check hashed password
      passwordValid = await bcrypt.compare(password, user.password_hash);
    } else {
      // Fallback for plain text passwords (migration period)
      passwordValid = password === user.password;
    }

    if (!passwordValid) {
      return res.status(401).json({ error: "Invalid userID or password" });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, userID: user.userid },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    // Send token + user info
    res.json({
      token,
      user: {
        id: user.id,
        userID: user.userid,
        name: user.name,
        barangay: user.barangay,
        barangay_position: user.barangay_position,
        profile_pic: user.profile_pic || null,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
