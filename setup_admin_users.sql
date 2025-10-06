-- ===================================================================
-- COMPLETE SETUP SQL FOR SUPABASE
-- Run this entire script in your Supabase SQL Editor
-- ===================================================================

-- 1. Create user_sessions table (if not already created)
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  device_info JSONB,
  ip_address INET,
  user_agent TEXT,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
  is_active BOOLEAN DEFAULT true
);

-- Create indices for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- Enable Row Level Security
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Service role full access on sessions" ON user_sessions;

-- Create policies for RLS
CREATE POLICY "Users can view own sessions" ON user_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own sessions" ON user_sessions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Service role full access on sessions" ON user_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  UPDATE user_sessions 
  SET is_active = false 
  WHERE expires_at < NOW() AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Function to check for active sessions for a user
CREATE OR REPLACE FUNCTION check_active_sessions(p_user_id UUID)
RETURNS TABLE (
  session_count INTEGER,
  active_sessions JSONB
) AS $$
BEGIN
  -- First cleanup expired sessions
  PERFORM cleanup_expired_sessions();
  
  -- Return active session count and details
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as session_count,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'device_info', device_info,
          'ip_address', ip_address,
          'last_activity', last_activity,
          'created_at', created_at
        )
      ) FILTER (WHERE is_active = true),
      '[]'::jsonb
    ) as active_sessions
  FROM user_sessions 
  WHERE user_id = p_user_id AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Function to create new session and optionally terminate others
CREATE OR REPLACE FUNCTION create_user_session(
  p_user_id UUID,
  p_session_token TEXT,
  p_device_info JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_force_single_session BOOLEAN DEFAULT false
)
RETURNS TABLE (
  success BOOLEAN,
  existing_sessions INTEGER,
  session_id UUID
) AS $$
DECLARE
  existing_count INTEGER;
  new_session_id UUID;
BEGIN
  -- First cleanup expired sessions
  PERFORM cleanup_expired_sessions();
  
  -- Check for existing active sessions
  SELECT COUNT(*) INTO existing_count
  FROM user_sessions 
  WHERE user_id = p_user_id AND is_active = true;
  
  -- If force single session is true, deactivate all existing sessions
  IF p_force_single_session THEN
    UPDATE user_sessions 
    SET is_active = false, last_activity = NOW()
    WHERE user_id = p_user_id AND is_active = true;
    existing_count := 0;
  END IF;
  
  -- Create new session
  INSERT INTO user_sessions (
    user_id, 
    session_token, 
    device_info, 
    ip_address, 
    user_agent
  ) VALUES (
    p_user_id, 
    p_session_token, 
    p_device_info, 
    p_ip_address, 
    p_user_agent
  ) RETURNING id INTO new_session_id;
  
  RETURN QUERY SELECT true, existing_count, new_session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to terminate a specific session
CREATE OR REPLACE FUNCTION terminate_user_session(p_session_token TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_sessions 
  SET is_active = false, last_activity = NOW()
  WHERE session_token = p_session_token AND is_active = true;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to update session activity
CREATE OR REPLACE FUNCTION update_session_activity(p_session_token TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_sessions 
  SET last_activity = NOW()
  WHERE session_token = p_session_token AND is_active = true;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- 2. CREATE ADMIN USERS (Updated approach)
-- ===================================================================

-- We'll create the users table entries first, then create Supabase auth users
-- This ensures the profile IDs will match the auth IDs

-- Create a function to properly set up admin users
CREATE OR REPLACE FUNCTION setup_admin_user(
    p_userid TEXT,
    p_name TEXT,
    p_barangay TEXT,
    p_position TEXT
) RETURNS UUID AS $$
DECLARE
    new_uuid UUID;
BEGIN
    -- Generate a new UUID
    new_uuid := gen_random_uuid();
    
    -- Insert or update the user
    INSERT INTO users (id, userid, name, barangay, barangay_position) 
    VALUES (new_uuid, p_userid, p_name, p_barangay, p_position)
    ON CONFLICT (userid) DO UPDATE SET
        name = EXCLUDED.name,
        barangay = EXCLUDED.barangay,
        barangay_position = EXCLUDED.barangay_position,
        updated_at = NOW()
    RETURNING id INTO new_uuid;
    
    -- If it was an update, get the existing ID
    IF new_uuid IS NULL THEN
        SELECT id INTO new_uuid FROM users WHERE userid = p_userid;
    END IF;
    
    RAISE NOTICE 'Admin user % setup with UUID: %', p_userid, new_uuid;
    RETURN new_uuid;
END;
$$ LANGUAGE plpgsql;

-- Set up the three admin users
SELECT setup_admin_user('admin1', 'System Administrator', 'Poblacion I', 'System Admin');
SELECT setup_admin_user('admin2', 'User Manager', 'Poblacion II', 'User Manager');
SELECT setup_admin_user('admin3', 'Support Administrator', 'Poblacion III', 'Support Admin');

-- ===================================================================
-- 3. CREATE SUPABASE AUTH USERS FOR ADMINS
-- Note: This part needs to be done via Supabase Dashboard or Admin API
-- ===================================================================

-- Create a function to help with admin user setup
CREATE OR REPLACE FUNCTION get_admin_users_info()
RETURNS TABLE (
    userid TEXT,
    name TEXT,
    email TEXT,
    suggested_password TEXT,
    user_uuid UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.userid::TEXT,
        u.name::TEXT,
        (u.userid || '@login.local')::TEXT as email,
        (u.userid || '_Admin123!')::TEXT as suggested_password,
        u.id as user_uuid
    FROM users u 
    WHERE u.userid IN ('admin1', 'admin2', 'admin3')
    ORDER BY u.userid;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- 4. VERIFICATION QUERIES
-- ===================================================================

-- Check if admin users were created successfully
SELECT 
    userid,
    name,
    barangay,
    barangay_position,
    created_at
FROM users 
WHERE userid IN ('admin1', 'admin2', 'admin3')
ORDER BY userid;

-- Get admin user information for Supabase Auth setup
SELECT * FROM get_admin_users_info();

-- ===================================================================
-- SETUP INSTRUCTIONS - UPDATED APPROACH
-- ===================================================================

/*
IMPORTANT: To fix the "failed to load user profile" error, follow these steps:

STEP 1: Run this SQL script first
- This creates the user profiles in the users table with specific UUIDs

STEP 2: Get the UUIDs for manual auth user creation
- Run this query to get the UUIDs that were generated:
*/

SELECT 
    userid,
    name,
    id as uuid_for_auth,
    (userid || '@login.local') as email,
    (userid || '_Admin123!') as password
FROM users 
WHERE userid IN ('admin1', 'admin2', 'admin3')
ORDER BY userid;

/*
STEP 3: Create Supabase Auth users with EXACT UUIDs

**CRITICAL**: When creating auth users in Supabase Dashboard, you MUST:

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User"
3. For EACH admin user, you need to:

   a) Fill in the form:
      - Email: {userid}@login.local
      - Password: {userid}_Admin123!
      - Auto Confirm User: ✅ YES

   b) **AFTER CREATING**: Click on the user in the list
   c) **COPY THE AUTH UUID** from the user details
   d) **UPDATE THE USERS TABLE** with this auth UUID:

      UPDATE users 
      SET id = '{PASTE_AUTH_UUID_HERE}' 
      WHERE userid = '{admin_userid}';

EXAMPLE for admin1:
1. Create auth user with email: admin1@login.local
2. Copy the UUID from auth user (e.g., 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
3. Run: UPDATE users SET id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' WHERE userid = 'admin1';

STEP 4: Verify the setup
Run this to confirm UUIDs match:
*/

SELECT 
    u.userid,
    u.name,
    u.id as profile_uuid,
    'Check if this matches auth user UUID' as note
FROM users u 
WHERE u.userid IN ('admin1', 'admin2', 'admin3')
ORDER BY u.userid;

/*
ALTERNATIVE APPROACH (Easier):
If you want to avoid UUID matching, you can delete existing auth users and recreate them,
then update the users table to match the new auth UUIDs.

This ensures the profile ID matches the auth ID, which is required for RLS to work properly.
*/
