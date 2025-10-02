#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const envContent = `# Supabase Configuration
SUPABASE_URL=https://bhcecrbyknorjzkjazxu.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoY2VjcmJ5a25vcmp6a2phenh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDYwNDMsImV4cCI6MjA3NDc4MjA0M30.Nfv0vHVk1IyN1gz1Y4mdogL9ChsV0DkiMQivuYnolt4
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoY2VjcmJ5a25vcmp6a2phenh1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTIwNjA0MywiZXhwIjoyMDc0NzgyMDQzfQ.-LqHm9_6n_eYFSYmEtvRnuGOXV--vU-p13CSoOJwP0g

# JWT Configuration (for custom auth if needed)
JWT_SECRET=supersecretkey
JWT_EXPIRES_IN=1h

# Server Configuration
PORT=4001
HOST=0.0.0.0

# Security Configuration
BCRYPT_ROUNDS=10

# Old Database (for migration)
OLD_DB_USER=postgres
OLD_DB_HOST=localhost
OLD_DB_NAME=SilangEmergency
OLD_DB_PASSWORD=kenpogi0223
OLD_DB_PORT=5432
`;

const frontendEnvContent = `# Frontend Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://bhcecrbyknorjzkjazxu.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoY2VjcmJ5a25vcmp6a2phenh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDYwNDMsImV4cCI6MjA3NDc4MjA0M30.Nfv0vHVk1IyN1gz1Y4mdogL9ChsV0DkiMQivuYnolt4
`;

function createEnvFile(filePath, content, description) {
  try {
    if (fs.existsSync(filePath)) {
      console.log(`⚠️  ${description} already exists, skipping...`);
      return;
    }
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ Created ${description}`);
  } catch (error) {
    console.error(`❌ Failed to create ${description}:`, error.message);
  }
}

function main() {
  console.log('🔧 Environment Setup Script');
  console.log('===========================\n');
  
  // Create backend .env file
  const backendEnvPath = path.join(__dirname, '..', '.env');
  createEnvFile(backendEnvPath, envContent, 'backend/.env file');
  
  // Create frontend .env file
  const frontendEnvPath = path.join(__dirname, '..', '..', '.env');
  createEnvFile(frontendEnvPath, frontendEnvContent, 'frontend .env file');
  
  console.log('\n🎯 Next steps:');
  console.log('1. Go to your Supabase dashboard: https://supabase.com/dashboard');
  console.log('2. Navigate to SQL Editor');
  console.log('3. Copy and paste the contents of backend/scripts/sql-setup.sql');
  console.log('4. Run the SQL script to create tables');
  console.log('5. Run: node scripts/test-connection.js to verify tables');
  console.log('6. Run: node scripts/migrate-data.js to migrate your data');
  console.log('7. Start your backend: npm start');
}

if (require.main === module) {
  main();
}
