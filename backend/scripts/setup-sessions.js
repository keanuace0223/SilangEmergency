require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { supabaseAdmin } = require('../config/supabase');

async function setupSessions() {
  try {
    console.log('🔧 Setting up user sessions table...');

    // Read the SQL file
    const sqlPath = path.join(__dirname, '../sql/05_create_user_sessions_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // If the RPC doesn't exist, try direct execution (this might not work in all setups)
      console.log('exec_sql RPC not available, attempting direct execution...');
      
      // Split the SQL into individual statements
      const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
      
      for (const statement of statements) {
        if (statement.trim()) {
          console.log('Executing:', statement.substring(0, 50) + '...');
          
          try {
            // For CREATE statements, we need to use the raw SQL execution
            const { error: execError } = await supabaseAdmin.rpc('exec', { 
              sql: statement.trim() + ';' 
            });
            
            if (execError) {
              console.warn('Statement failed:', execError.message);
            }
          } catch (err) {
            console.warn('Statement execution error:', err.message);
          }
        }
      }
    } else {
      console.log('✅ Sessions table setup completed successfully!');
    }

    // Test the functions
    console.log('🧪 Testing session functions...');
    
    // Test cleanup function
    const { error: cleanupError } = await supabaseAdmin.rpc('cleanup_expired_sessions');
    if (cleanupError) {
      console.warn('Cleanup test failed:', cleanupError.message);
    } else {
      console.log('✅ Cleanup function works!');
    }

    console.log('🎉 Session system setup complete!');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Alternative manual setup if the above doesn't work
async function manualSetup() {
  try {
    console.log('🔧 Manual setup of sessions table...');

    // Create table
    const { error: tableError } = await supabaseAdmin.rpc('exec', {
      sql: `
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
      `
    });

    if (tableError) {
      console.error('Table creation failed:', tableError);
    } else {
      console.log('✅ Table created successfully');
    }

    console.log('✅ Manual setup complete! You may need to run the full SQL file manually.');

  } catch (error) {
    console.error('❌ Manual setup failed:', error);
  }
}

if (require.main === module) {
  const arg = process.argv[2];
  if (arg === '--manual') {
    manualSetup();
  } else {
    setupSessions();
  }
}
