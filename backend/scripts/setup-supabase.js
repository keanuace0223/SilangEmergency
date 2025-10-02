#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runSQLFile(filePath) {
  try {
    console.log(`📄 Running SQL file: ${filePath}`);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error(`❌ Error running ${filePath}:`, error);
      return false;
    }
    
    console.log(`✅ Successfully ran ${filePath}`);
    return true;
  } catch (err) {
    console.error(`❌ Error reading ${filePath}:`, err.message);
    return false;
  }
}

async function setupDatabase() {
  console.log('🚀 Setting up Supabase database...');
  
  const sqlFiles = [
    '01_create_users_table.sql',
    '02_create_reports_table.sql',
    '03_create_functions.sql'
  ];
  
  for (const file of sqlFiles) {
    const filePath = path.join(__dirname, '..', 'sql', file);
    if (fs.existsSync(filePath)) {
      const success = await runSQLFile(filePath);
      if (!success) {
        console.error(`❌ Failed to run ${file}`);
        process.exit(1);
      }
    } else {
      console.error(`❌ SQL file not found: ${filePath}`);
      process.exit(1);
    }
  }
  
  console.log('🎉 Database setup completed successfully!');
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
    console.log(`📊 Users table exists with ${data?.length || 0} records`);
    return true;
  } catch (err) {
    console.error('❌ Connection test failed:', err.message);
    return false;
  }
}

async function main() {
  console.log('🔧 Supabase Setup Script');
  console.log('========================\n');
  
  // Test connection first
  const connectionOk = await testConnection();
  if (!connectionOk) {
    console.error('❌ Cannot connect to Supabase. Please check your credentials.');
    process.exit(1);
  }
  
  // Setup database schema
  await setupDatabase();
  
  console.log('\n🎯 Next steps:');
  console.log('1. Run the data migration: node scripts/migrate-data.js');
  console.log('2. Test your API endpoints');
  console.log('3. Update your frontend environment variables');
  console.log('4. Deploy to production');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { setupDatabase, testConnection };
