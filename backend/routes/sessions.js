const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const { supabaseAdmin } = require("../config/supabase");

// Middleware to extract device info from request
const extractDeviceInfo = (req) => {
  const userAgent = req.headers['user-agent'] || '';
  const deviceInfo = {
    userAgent,
    platform: 'unknown',
    deviceType: 'unknown',
    deviceName: 'Unknown Device'
  };

  // Basic platform detection
  if (userAgent.includes('iPhone')) {
    deviceInfo.platform = 'iOS';
    deviceInfo.deviceType = 'phone';
    deviceInfo.deviceName = 'iPhone';
  } else if (userAgent.includes('iPad')) {
    deviceInfo.platform = 'iOS';
    deviceInfo.deviceType = 'tablet';
    deviceInfo.deviceName = 'iPad';
  } else if (userAgent.includes('Android')) {
    deviceInfo.platform = 'Android';
    deviceInfo.deviceType = userAgent.includes('Mobile') ? 'phone' : 'tablet';
    deviceInfo.deviceName = `${deviceInfo.platform} ${deviceInfo.deviceType}`;
  } else if (userAgent.includes('Windows')) {
    deviceInfo.platform = 'Windows';
    deviceInfo.deviceType = 'desktop';
    deviceInfo.deviceName = 'Windows PC';
  } else if (userAgent.includes('Mac')) {
    deviceInfo.platform = 'macOS';
    deviceInfo.deviceType = 'desktop';
    deviceInfo.deviceName = 'Mac';
  } else if (userAgent.includes('Linux')) {
    deviceInfo.platform = 'Linux';
    deviceInfo.deviceType = 'desktop';
    deviceInfo.deviceName = 'Linux PC';
  }

  return deviceInfo;
};

// Get client IP address
const getClientIP = (req) => {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         '0.0.0.0';
};

// Check active sessions for a user
router.get("/check/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const { data, error } = await supabaseAdmin
      .rpc('check_active_sessions', { p_user_id: userId });

    if (error) {
      console.error("Error checking sessions:", error);
      return res.status(500).json({ error: "Failed to check sessions" });
    }

    const result = data?.[0] || { session_count: 0, active_sessions: [] };
    
    res.json({
      sessionCount: result.session_count || 0,
      activeSessions: result.active_sessions || []
    });
  } catch (err) {
    console.error("Session check error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Create a new session
router.post("/create", async (req, res) => {
  const { userId, forceSingleSession = false } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    // Generate unique session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Extract device and IP info
    const deviceInfo = extractDeviceInfo(req);
    const ipAddress = getClientIP(req);

    const { data, error } = await supabaseAdmin
      .rpc('create_user_session', {
        p_user_id: userId,
        p_session_token: sessionToken,
        p_device_info: deviceInfo,
        p_ip_address: ipAddress,
        p_user_agent: req.headers['user-agent'] || null,
        p_force_single_session: forceSingleSession
      });

    if (error) {
      console.error("Error creating session:", error);
      return res.status(500).json({ error: "Failed to create session" });
    }

    const result = data?.[0];
    
    res.json({
      success: result?.success || false,
      sessionToken,
      sessionId: result?.session_id,
      existingSessions: result?.existing_sessions || 0,
      deviceInfo,
      ipAddress
    });
  } catch (err) {
    console.error("Session creation error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Terminate a session
router.post("/terminate", async (req, res) => {
  const { sessionToken } = req.body;

  if (!sessionToken) {
    return res.status(400).json({ error: "Session token is required" });
  }

  try {
    const { data, error } = await supabaseAdmin
      .rpc('terminate_user_session', { p_session_token: sessionToken });

    if (error) {
      console.error("Error terminating session:", error);
      return res.status(500).json({ error: "Failed to terminate session" });
    }

    res.json({ success: data || false });
  } catch (err) {
    console.error("Session termination error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update session activity (heartbeat)
router.post("/heartbeat", async (req, res) => {
  const { sessionToken } = req.body;

  if (!sessionToken) {
    return res.status(400).json({ error: "Session token is required" });
  }

  try {
    const { data, error } = await supabaseAdmin
      .rpc('update_session_activity', { p_session_token: sessionToken });

    if (error) {
      console.error("Error updating session activity:", error);
      return res.status(500).json({ error: "Failed to update session activity" });
    }

    res.json({ success: data || false });
  } catch (err) {
    console.error("Session heartbeat error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all sessions for a user
router.get("/user/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const { data, error } = await supabaseAdmin
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('last_activity', { ascending: false });

    if (error) {
      console.error("Error fetching user sessions:", error);
      return res.status(500).json({ error: "Failed to fetch sessions" });
    }

    res.json({ sessions: data || [] });
  } catch (err) {
    console.error("User sessions fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Cleanup expired sessions (can be called periodically)
router.post("/cleanup", async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .rpc('cleanup_expired_sessions');

    if (error) {
      console.error("Error cleaning up sessions:", error);
      return res.status(500).json({ error: "Failed to cleanup sessions" });
    }

    res.json({ success: true, message: "Expired sessions cleaned up" });
  } catch (err) {
    console.error("Session cleanup error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

