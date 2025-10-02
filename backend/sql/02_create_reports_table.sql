-- Create reports table for Supabase
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
