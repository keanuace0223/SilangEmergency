#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load env from backend/.env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.replace(/^--/, '').split('=');
      args[k] = v ?? argv[++i];
    }
  }
  return args;
}

(async () => {
  const args = parseArgs(process.argv);
  const userid = args.userid || args.u;
  const name = args.name || 'New User';
  const barangay = args.barangay || 'Brgy. X';
  const barangay_position = args.position || 'Member';
  const password = args.password || 'Temp123!';
  const email = args.email || (userid ? `${userid}@login.local` : undefined);

  if (!userid) {
    console.error('Usage: node scripts/create-auth-user.js --userid <userid> [--name "Full Name"] [--barangay "Brgy."] [--position "Role"] [--password "Temp123!"] [--email "real@domain"]');
    process.exit(1);
  }

  if (!email) {
    console.error('❌ Could not derive email');
    process.exit(1);
  }

  console.log(`➡️  Creating auth user for userid=${userid}, email=${email}`);

  // 1) Create auth user (or resolve existing)
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { userid, name }
  });

  let authUserId = created?.user?.id;
  if (createErr) {
    if (createErr.status === 422) {
      // Already exists: resolve
      const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      if (listErr) {
        console.error('❌ listUsers error:', listErr.message || listErr);
        process.exit(1);
      }
      const found = list.users?.find(u => (u.email || '').toLowerCase() === email.toLowerCase());
      if (!found) {
        console.error('❌ User exists in Auth but could not be found by email.');
        process.exit(1);
      }
      authUserId = found.id;
      // Optionally sync password
      const { error: updPassErr } = await supabase.auth.admin.updateUserById(authUserId, { password });
      if (updPassErr) console.warn('⚠️  Failed to update password for existing user:', updPassErr.message);
    } else {
      console.error('❌ createUser error:', createErr.message || createErr);
      process.exit(1);
    }
  }

  if (!authUserId) {
    console.error('❌ Missing auth user id');
    process.exit(1);
  }

  // 2) Upsert profile row, aligning id with auth uid
  console.log('➡️  Upserting profile row in users');
  const { error: upErr } = await supabase
    .from('users')
    .upsert({ id: authUserId, userid, name, barangay, barangay_position }, { onConflict: 'id' });
  if (upErr) {
    console.error('❌ Upsert profile failed:', upErr.message || upErr);
    process.exit(1);
  }

  console.log('✅ User created/updated successfully');
})().catch((e) => { console.error(e); process.exit(1); });


