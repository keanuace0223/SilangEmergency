require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');

async function setupSessionsSupabase() {
  try {
    console.log('🔧 Setting up user sessions table via Supabase client...');

    // Step 1: Create the main table
    console.log('Creating user_sessions table...');
    const { error: tableError } = await supabaseAdmin
      .from('user_sessions')
      .select('id')
      .limit(1);

    if (tableError && tableError.message.includes('relation "user_sessions" does not exist')) {
      console.log('Table does not exist, you need to create it manually in Supabase dashboard or via SQL.');
      console.log('\n📋 Please execute this SQL in your Supabase SQL Editor:');
      console.log('=' .repeat(60));
      console.log(`
-- Create user_sessions table to track active sessions across devices
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

-- Create policies for RLS
-- Users can read their own sessions
CREATE POLICY "Users can view own sessions" ON user_sessions
  FOR SELECT USING (user_id = auth.uid());

-- Users can update their own sessions
CREATE POLICY "Users can update own sessions" ON user_sessions
  FOR UPDATE USING (user_id = auth.uid());

-- Service role can do everything (for backend operations)
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
      `);
      console.log('=' .repeat(60));
      console.log('\n✨ After running the SQL, run this script again to test the setup.');
      return;
    } else if (tableError) {
      console.error('❌ Error checking table:', tableError);
      return;
    } else {
      console.log('✅ user_sessions table already exists!');
    }

    // Test the functions
    console.log('🧪 Testing session functions...');
    
    // Test cleanup function
    try {
      const { error: cleanupError } = await supabaseAdmin.rpc('cleanup_expired_sessions');
      if (cleanupError) {
        console.warn('⚠️ Cleanup function test failed:', cleanupError.message);
        console.log('This might mean the function hasn\'t been created yet. Please run the SQL above.');
      } else {
        console.log('✅ cleanup_expired_sessions function works!');
      }
    } catch (error) {
      console.warn('⚠️ Cleanup function test error:', error.message);
    }

    // Test check sessions function with a dummy UUID
    try {
      const dummyUuid = '00000000-0000-0000-0000-000000000000';
      const { data, error: checkError } = await supabaseAdmin.rpc('check_active_sessions', {
        p_user_id: dummyUuid
      });
      
      if (checkError) {
        console.warn('⚠️ Check sessions function test failed:', checkError.message);
        console.log('This might mean the function hasn\'t been created yet. Please run the SQL above.');
      } else {
        console.log('✅ check_active_sessions function works!');
        console.log('   Sample response:', data);
      }
    } catch (error) {
      console.warn('⚠️ Check sessions function test error:', error.message);
    }

    console.log('\n🎉 Session system setup verification complete!');
    console.log('📚 Check the documentation at docs/MULTI_DEVICE_LOGIN_PREVENTION.md for usage instructions.');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setupSessionsSupabase();
}

module.exports = { setupSessionsSupabase };

