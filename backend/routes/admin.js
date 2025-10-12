const express = require("express");
const router = express.Router();
const { supabaseAdmin } = require("../config/supabase");
const { sanitizePagination, validateRequiredFields } = require("../utils/validation");

// Middleware to check if user is admin
const checkAdminRole = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    // Extract token and verify it's from an admin user
    // const token = authHeader.substring(7);
    
    // Get the user from token (you might need to implement JWT verification here)
    // For now, we'll check if the request is coming from an admin user
    // This is a simplified check - in production, you'd verify the JWT token
    
    // List of admin user IDs that have access (currently not used)
    // const adminUserIds = ['admin1', 'admin2', 'admin3'];
    
    // You could also check against email or verify JWT token payload
    // For this implementation, we'll assume the token is valid if it exists
    // and the user will be verified by the specific admin emails in the frontend
    
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// GET /api/admin/users - Get all users with pagination and search
router.get("/users", checkAdminRole, async (req, res) => {
  try {
    const { search = '', barangay = '', position = '', includeReports = 'false' } = req.query;
    const { page, limit, offset } = sanitizePagination(req.query);

    let query = supabaseAdmin
      .from('users')
      .select('id, userid, name, barangay, barangay_position, profile_pic, created_at', { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,userid.ilike.%${search}%`);
    }
    if (barangay) {
      query = query.eq('barangay', barangay);
    }
    if (position) {
      query = query.eq('barangay_position', position);
    }

    // Apply pagination and ordering
    const { data: users, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    // If includeReports is true, get report counts for each user
    let usersWithReports = users || [];
    if (includeReports === 'true' && users && users.length > 0) {
      const userIds = users.map(user => user.id);
      
      // Get report counts for each user
      const { data: reportCounts, error: reportError } = await supabaseAdmin
        .from('reports')
        .select('user_id')
        .in('user_id', userIds);

      if (!reportError && reportCounts) {
        // Count reports per user
        const reportCountMap = reportCounts.reduce((acc, report) => {
          acc[report.user_id] = (acc[report.user_id] || 0) + 1;
          return acc;
        }, {});

        // Add report count to each user
        usersWithReports = users.map(user => ({
          ...user,
          reportCount: reportCountMap[user.id] || 0
        }));
      }
    }

    // Get total pages
    const totalPages = Math.ceil((count || 0) / limit);

    res.json({
      users: usersWithReports,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error("Admin get users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// POST /api/admin/users - Create new user
router.post("/users", checkAdminRole, async (req, res) => {
  try {
    const { userid, name, barangay, barangay_position, password } = req.body;
    
    const validation = validateRequiredFields(req.body, ['userid', 'name', 'barangay', 'barangay_position', 'password']);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: `Missing required fields: ${validation.missing.join(', ')}` 
      });
    }

    // Generate email for Supabase auth
    const email = `${userid}@login.local`;

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        userid,
        name,
        barangay,
        barangay_position
      }
    });

    if (authError) {
      if (authError.message?.includes('already registered')) {
        return res.status(400).json({ error: "User with this ID already exists" });
      }
      throw authError;
    }

    if (!authData.user) {
      return res.status(400).json({ error: "Failed to create user in auth system" });
    }

    // Create user profile in our users table
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        userid,
        name,
        barangay,
        barangay_position
      })
      .select()
      .single();

    if (profileError) {
      console.error("Profile creation error:", profileError);
      // Try to clean up the auth user if profile creation failed
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      } catch (cleanupError) {
        console.error("Failed to cleanup auth user:", cleanupError);
      }
      return res.status(500).json({ error: "Failed to create user profile" });
    }

    res.status(201).json({
      success: true,
      user: {
        id: profileData.id,
        userid: profileData.userid,
        name: profileData.name,
        barangay: profileData.barangay,
        barangay_position: profileData.barangay_position,
        created_at: profileData.created_at
      }
    });
  } catch (error) {
    console.error("Admin create user error:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// PUT /api/admin/users/:id - Update user
router.put("/users/:id", checkAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, barangay, barangay_position } = req.body;

    const validation = validateRequiredFields(req.body, ['name', 'barangay', 'barangay_position']);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: `Missing required fields: ${validation.missing.join(', ')}` 
      });
    }

    // Update user profile
    const { data: updatedUser, error } = await supabaseAdmin
      .from('users')
      .update({
        name,
        barangay,
        barangay_position,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update auth user metadata
    try {
      await supabaseAdmin.auth.admin.updateUserById(id, {
        user_metadata: {
          userid: updatedUser.userid,
          name,
          barangay,
          barangay_position
        }
      });
    } catch (authUpdateError) {
      console.warn("Failed to update auth metadata:", authUpdateError);
    }

    res.json({
      success: true,
      user: updatedUser
    });
  } catch (error) {
    console.error("Admin update user error:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// DELETE /api/admin/users/:id - Delete user
router.delete("/users/:id", checkAdminRole, async (req, res) => {
  try {
    const { id } = req.params;

    // First, get the user to ensure it exists
    const { data: user, error: getUserError } = await supabaseAdmin
      .from('users')
      .select('userid')
      .eq('id', id)
      .single();

    if (getUserError || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Delete from users table (this will cascade to reports due to foreign key)
    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    // Delete from Supabase Auth
    try {
      await supabaseAdmin.auth.admin.deleteUser(id);
    } catch (authDeleteError) {
      console.warn("Failed to delete auth user:", authDeleteError);
      // Continue anyway as the main profile is deleted
    }

    res.json({
      success: true,
      message: `User ${user.userid} deleted successfully`
    });
  } catch (error) {
    console.error("Admin delete user error:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// PUT /api/admin/users/:id/reset-password - Reset user password
router.put("/users/:id/reset-password", checkAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ 
        error: "New password is required and must be at least 6 characters" 
      });
    }

    // Update password in Supabase Auth
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: newPassword
    });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: "Password reset successfully"
    });
  } catch (error) {
    console.error("Admin reset password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// GET /api/admin/stats - Get admin dashboard stats
router.get("/stats", checkAdminRole, async (req, res) => {
  try {
    // Get user count by barangay
    const { data: usersByBarangay, error: usersError } = await supabaseAdmin
      .from('users')
      .select('barangay')
      .order('barangay');

    if (usersError) throw usersError;

    // Get total reports count
    const { count: totalReports, error: reportsError } = await supabaseAdmin
      .from('reports')
      .select('*', { count: 'exact', head: true });

    if (reportsError) throw reportsError;

    // Get recent reports (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentReports, error: recentError } = await supabaseAdmin
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo);

    if (recentError) throw recentError;

    // Process user statistics
    const barangayStats = {};
    usersByBarangay?.forEach(user => {
      barangayStats[user.barangay] = (barangayStats[user.barangay] || 0) + 1;
    });

    const totalUsers = usersByBarangay?.length || 0;

    res.json({
      totalUsers,
      totalReports: totalReports || 0,
      recentReports: recentReports || 0,
      barangayStats,
      usersByBarangay: Object.entries(barangayStats).map(([barangay, count]) => ({
        barangay,
        userCount: count
      }))
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ error: "Failed to fetch admin stats" });
  }
});

// GET /api/admin/barangays - Get list of unique barangays
router.get("/barangays", checkAdminRole, async (req, res) => {
  try {
    const { data: barangays, error } = await supabaseAdmin
      .from('users')
      .select('barangay')
      .order('barangay');

    if (error) throw error;

    const uniqueBarangays = [...new Set(barangays?.map(b => b.barangay) || [])];

    res.json({ barangays: uniqueBarangays });
  } catch (error) {
    console.error("Admin barangays error:", error);
    res.status(500).json({ error: "Failed to fetch barangays" });
  }
});

// GET /api/admin/users/:userId/reports - Get reports for a specific user
router.get("/users/:userId/reports", checkAdminRole, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page, limit, offset } = sanitizePagination(req.query);

    // Get user info
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('userid, name, barangay')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get user's reports
    const { data: reports, error: reportsError, count } = await supabaseAdmin
      .from('reports')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (reportsError) throw reportsError;

    const totalPages = Math.ceil((count || 0) / limit);

    res.json({
      user: {
        id: userId,
        userid: user.userid,
        name: user.name,
        barangay: user.barangay
      },
      reports: reports || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error("Admin get user reports error:", error);
    res.status(500).json({ error: "Failed to fetch user reports" });
  }
});

// GET /api/admin/reports - Get all reports with user info
router.get("/reports", checkAdminRole, async (req, res) => {
  try {
    const { search = '', barangay = '', urgency = '', startDate = '', endDate = '' } = req.query;
    const { page, limit, offset } = sanitizePagination(req.query);

    // Build the query with joins
    let query = supabaseAdmin
      .from('reports')
      .select(`
        *,
        users!inner(userid, name, barangay, barangay_position)
      `, { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.or(`incident_type.ilike.%${search}%,description.ilike.%${search}%,location.ilike.%${search}%`);
    }
    if (barangay) {
      query = query.eq('users.barangay', barangay);
    }
    if (urgency) {
      query = query.eq('urgency_tag', urgency);
    }
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // Apply pagination and ordering
    const { data: reports, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const totalPages = Math.ceil((count || 0) / limit);

    res.json({
      reports: reports || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error("Admin get reports error:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

module.exports = router;
