const express = require("express");
const router = express.Router();
const { supabase, supabaseAdmin } = require("../config/supabase");

// Sign up with email and password
router.post("/signup", async (req, res) => {
  try {
    const { email, password, name, barangay, barangay_position } = req.body;

    // Validate required fields
    if (!email || !password || !name || !barangay || !barangay_position) {
      return res.status(400).json({ 
        error: "email, password, name, barangay, and barangay_position are required" 
      });
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          barangay,
          barangay_position
        }
      }
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    if (!authData.user) {
      return res.status(400).json({ error: "Failed to create user" });
    }

    // Create user profile in our users table
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        userid: email, // Use email as userid
        name,
        barangay,
        barangay_position
      })
      .select()
      .single();

    if (profileError) {
      console.error("Profile creation error:", profileError);
      // Note: User is created in auth but not in our table
      return res.status(500).json({ error: "Failed to create user profile" });
    }

    res.status(201).json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name,
        barangay,
        barangay_position
      },
      session: authData.session
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Sign in with email and password
router.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    if (!data.user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      return res.status(500).json({ error: "Failed to fetch user profile" });
    }

    res.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        name: profile.name,
        barangay: profile.barangay,
        barangay_position: profile.barangay_position,
        profile_pic: profile.profile_pic
      },
      session: data.session
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Sign out
router.post("/signout", async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: "Signed out successfully" });
  } catch (error) {
    console.error("Signout error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get current user
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "No valid authorization header" });
    }

    const token = authHeader.substring(7);
    
    // Verify the token and get user
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      return res.status(500).json({ error: "Failed to fetch user profile" });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: profile.name,
        barangay: profile.barangay,
        barangay_position: profile.barangay_position,
        profile_pic: profile.profile_pic
      }
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Refresh session
router.post("/refresh", async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: "refresh_token is required" });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.json({
      session: data.session
    });
  } catch (error) {
    console.error("Refresh error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
