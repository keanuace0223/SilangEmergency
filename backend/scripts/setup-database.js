#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Your Supabase credentials
const supabaseUrl = 'https://bhcecrbyknorjzkjazxu.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoY2VjcmJ5a25vcmp6a2phenh1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTIwNjA0MywiZXhwIjoyMDc0NzgyMDQzfQ.-LqHm9_6n_eYFSYmEtvRnuGOXV--vU-p13CSoOJwP0g';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createUsersTable() {
  console.log('📄 Creating users table...');
  
  const sql = `
    -- Create users table for Supabase
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

    -- Create index for faster lookups
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
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.error('❌ Error creating users table:', error);
      return false;
    }
    console.log('✅ Users table created successfully!');
    return true;
  } catch (err) {
    console.error('❌ Error creating users table:', err.message);
    return false;
  }
}

async function createReportsTable() {
  console.log('📄 Creating reports table...');
  
  const sql = `
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
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.error('❌ Error creating reports table:', error);
      return false;
    }
    console.log('✅ Reports table created successfully!');
    return true;
  } catch (err) {
    console.error('❌ Error creating reports table:', err.message);
    return false;
  }
}

async function createFunctions() {
  console.log('📄 Creating database functions...');
  
  const sql = `
    -- Create function to automatically update updated_at timestamp
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
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.error('❌ Error creating functions:', error);
      return false;
    }
    console.log('✅ Database functions created successfully!');
    return true;
  } catch (err) {
    console.error('❌ Error creating functions:', err.message);
    return false;
  }
}

async function testConnection() {
  console.log('🔍 Testing Supabase connection...');
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Connection test failed:', error);
      return false;
    }
    
    console.log('✅ Supabase connection successful!');
    return true;
  } catch (err) {
    console.error('❌ Connection test failed:', err.message);
    return false;
  }
}

async function main() {
  console.log('🔧 Supabase Database Setup');
  console.log('==========================\n');
  
  // Test connection first
  const connectionOk = await testConnection();
  if (!connectionOk) {
    console.error('❌ Cannot connect to Supabase. Please check your credentials.');
    process.exit(1);
  }
  
  // Create tables
  const usersOk = await createUsersTable();
  if (!usersOk) {
    console.error('❌ Failed to create users table');
    process.exit(1);
  }
  
  const reportsOk = await createReportsTable();
  if (!reportsOk) {
    console.error('❌ Failed to create reports table');
    process.exit(1);
  }
  
  const functionsOk = await createFunctions();
  if (!functionsOk) {
    console.error('❌ Failed to create functions');
    process.exit(1);
  }
  
  console.log('\n🎉 Database setup completed successfully!');
  console.log('\n🎯 Next steps:');
  console.log('1. Create a .env file in the backend directory with your Supabase credentials');
  console.log('2. Run the data migration: node scripts/migrate-data.js');
  console.log('3. Test your API endpoints');
  console.log('4. Update your frontend environment variables');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { createUsersTable, createReportsTable, createFunctions, testConnection };
