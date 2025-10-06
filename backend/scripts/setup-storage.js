// Create the 'reports' storage bucket in Supabase if it doesn't exist
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load env from backend/.env first, then fall back to project root .env
try {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
} catch {}
try {
  // Project root: ../../.env from backend/scripts
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
} catch {}

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    console.error('❌ Missing env. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in backend/.env');
    process.exit(1);
  }

  const supabase = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const bucketName = process.env.REPORTS_BUCKET_NAME || 'reports';

  // Check if bucket exists
  const { data: list, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) {
    console.error('❌ Failed to list buckets:', listErr.message);
    process.exit(1);
  }

  const exists = Array.isArray(list) && list.some((b) => b.name === bucketName);
  if (exists) {
    console.log(`✅ Bucket '${bucketName}' already exists.`);
    process.exit(0);
  }

  console.log(`🪣 Creating bucket '${bucketName}' (public: true)...`);
  const { error: createErr } = await supabase.storage.createBucket(bucketName, {
    public: true,
    fileSizeLimit: '20MB',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });
  if (createErr) {
    console.error('❌ Failed to create bucket:', createErr.message);
    process.exit(1);
  }

  console.log('✅ Bucket created successfully.');
  console.log('ℹ️ If uploads still fail, ensure the user is authenticated and storage policies allow uploads for authenticated users.');
}

main().catch((e) => {
  console.error('❌ Setup error:', e?.message || e);
  process.exit(1);
});


