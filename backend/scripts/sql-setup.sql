-- Supabase Database Setup Script
-- Copy and paste this into your Supabase SQL Editor

-- 1. Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  userid VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  barangay VARCHAR(255) NOT NULL,
  barangay_position VARCHAR(255) NOT NULL,
  profile_pic TEXT,
  password_hash TEXT, -- For custom auth migration
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_userid ON users(userid);
CREATE INDEX IF NOT EXISTS idx_users_barangay ON users(barangay);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
-- Users can read their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

-- Users can update their own data
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role full access" ON users
  FOR ALL USING (auth.role() = 'service_role');

-- 2. Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  incident_type VARCHAR(255) NOT NULL,
  location TEXT NOT NULL,
  urgency_tag VARCHAR(50) NOT NULL CHECK (urgency_tag IN ('Low', 'Moderate', 'High')),
  description TEXT NOT NULL,
  uploaded_media TEXT[] DEFAULT '{}',
  incident_datetime TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_incident_datetime ON reports(incident_datetime);
CREATE INDEX IF NOT EXISTS idx_reports_urgency ON reports(urgency_tag);

-- Enable Row Level Security
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
-- Users can view their own reports
CREATE POLICY "Users can view own reports" ON reports
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- Users can create their own reports
CREATE POLICY "Users can create own reports" ON reports
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Users can update their own reports
CREATE POLICY "Users can update own reports" ON reports
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Users can delete their own reports
CREATE POLICY "Users can delete own reports" ON reports
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role full access" ON reports
  FOR ALL USING (auth.role() = 'service_role');

-- 3. Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
CREATE TRIGGER update_reports_updated_at 
  BEFORE UPDATE ON reports 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
