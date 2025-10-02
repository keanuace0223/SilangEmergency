#!/usr/bin/env node

const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

// Supabase configuration
const supabaseUrl = 'https://bhcecrbyknorjzkjazxu.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoY2VjcmJ5a25vcmp6a2phenh1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTIwNjA0MywiZXhwIjoyMDc0NzgyMDQzfQ.-LqHm9_6n_eYFSYmEtvRnuGOXV--vU-p13CSoOJwP0g';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Old database configuration (for data migration)
const oldDbConfig = {
  user: process.env.OLD_DB_USER || "postgres",
  host: process.env.OLD_DB_HOST || "localhost",
  database: process.env.OLD_DB_NAME || "SilangEmergency",
  password: process.env.OLD_DB_PASSWORD || "kenpogi0223",
  port: process.env.OLD_DB_PORT || 5432,
};

let oldPool;

async function connectToOldDatabase() {
  try {
    oldPool = new Pool(oldDbConfig);
    console.log('🔗 Connected to old PostgreSQL database');
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to old database:', error.message);
    return false;
  }
}

async function migrateUsers() {
  console.log('🔄 Migrating users...');
  
  try {
    // Get all users from old database
    const result = await oldPool.query('SELECT * FROM users');
    const users = result.rows;
    
    console.log(`Found ${users.length} users to migrate`);
    
    for (const user of users) {
      try {
        // Hash the password if it's plain text
        const passwordHash = user.password ? await bcrypt.hash(user.password, 10) : null;
        
        // Insert user into Supabase
        const { data, error } = await supabase
          .from('users')
          .insert({
            userid: user.userid,
            name: user.name,
            barangay: user.barangay,
            barangay_position: user.barangay_position,
            profile_pic: user.profile_pic,
            password_hash: passwordHash
          })
          .select()
          .single();
          
        if (error) {
          console.error(`Error migrating user ${user.userid}:`, error);
        } else {
          console.log(`✅ Migrated user: ${user.name} (${user.userid})`);
        }
      } catch (err) {
        console.error(`Error processing user ${user.userid}:`, err);
      }
    }
    
    console.log('✅ Users migration completed');
  } catch (error) {
    console.error('Error migrating users:', error);
  }
}

async function migrateReports() {
  console.log('🔄 Migrating reports...');
  
  try {
    // Get all reports from old database
    const result = await oldPool.query('SELECT * FROM reports');
    const reports = result.rows;
    
    console.log(`Found ${reports.length} reports to migrate`);
    
    for (const report of reports) {
      try {
        // Get the corresponding user ID from Supabase
        // The user_id in reports table references the id field in users table
        let userId;
        
        // First, get the user from old database to find their userid
        const userResult = await oldPool.query('SELECT userid FROM users WHERE id = $1', [report.user_id]);
        
        if (userResult.rows.length === 0) {
          console.error(`User with id ${report.user_id} not found in old database for report ${report.id}, skipping...`);
          continue;
        }
        
        const oldUser = userResult.rows[0];
        
        // Now find the user in Supabase by their userid
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('userid', oldUser.userid)
          .single();
          
        if (userError || !userData) {
          console.error(`User with userid ${oldUser.userid} not found in Supabase for report ${report.id}, skipping...`);
          continue;
        }
        
        userId = userData.id;
        
        // Insert report into Supabase
        const { data, error } = await supabase
          .from('reports')
          .insert({
            user_id: userId,
            incident_type: report.incident_type,
            location: report.location,
            urgency_tag: report.urgency_tag,
            description: report.description,
            uploaded_media: report.uploaded_media || [],
            incident_datetime: report.incident_datetime
          })
          .select()
          .single();
          
        if (error) {
          console.error(`Error migrating report ${report.id}:`, error);
        } else {
          console.log(`✅ Migrated report: ${report.incident_type} at ${report.location}`);
        }
      } catch (err) {
        console.error(`Error processing report ${report.id}:`, err);
      }
    }
    
    console.log('✅ Reports migration completed');
  } catch (error) {
    console.error('Error migrating reports:', error);
  }
}

async function testSupabaseTables() {
  console.log('🔍 Testing Supabase tables...');
  
  try {
    // Test users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });
    
    if (usersError) {
      console.error('❌ Users table not accessible:', usersError.message);
      return false;
    }
    
    // Test reports table
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('count', { count: 'exact', head: true });
    
    if (reportsError) {
      console.error('❌ Reports table not accessible:', reportsError.message);
      return false;
    }
    
    console.log('✅ Both tables are accessible');
    return true;
  } catch (error) {
    console.error('❌ Error testing tables:', error.message);
    return false;
  }
}

async function migrateData() {
  console.log('🚀 Starting data migration to Supabase...');
  
  // Test Supabase tables first
  const tablesOk = await testSupabaseTables();
  if (!tablesOk) {
    console.error('❌ Supabase tables are not set up. Please run the SQL setup script first.');
    console.log('📋 Go to your Supabase dashboard > SQL Editor and run the contents of backend/scripts/sql-setup.sql');
    process.exit(1);
  }
  
  // Connect to old database
  const connected = await connectToOldDatabase();
  if (!connected) {
    console.error('❌ Cannot connect to old database. Please check your database is running and credentials are correct.');
    process.exit(1);
  }
  
  try {
    await migrateUsers();
    await migrateReports();
    console.log('🎉 Data migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    if (oldPool) {
      await oldPool.end();
    }
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateData();
}

module.exports = { migrateData, migrateUsers, migrateReports };