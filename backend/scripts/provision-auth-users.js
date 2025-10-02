#!/usr/bin/env node

const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Old database for plaintext passwords
const oldPool = new Pool({
  user: process.env.OLD_DB_USER || 'postgres',
  host: process.env.OLD_DB_HOST || 'localhost',
  database: process.env.OLD_DB_NAME || 'SilangEmergency',
  password: process.env.OLD_DB_PASSWORD || 'postgres',
  port: process.env.OLD_DB_PORT ? Number(process.env.OLD_DB_PORT) : 5432,
});

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function provision() {
  console.log('🚀 Provisioning Supabase Auth users from legacy DB');

  // Fetch users from legacy with plaintext password
  const { rows: legacyUsers } = await oldPool.query('select userid, password, name, barangay, barangay_position, profile_pic from users');
  console.log(`Found ${legacyUsers.length} legacy users`);

  for (const u of legacyUsers) {
    const email = `${u.userid}@login.local`;
    console.log(`\n➡️  Provision ${u.userid} (${email})`);

    // 1) Create (or get) auth user
    const { data: authRes, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: u.password || `${u.userid}_Temp123!`,
      email_confirm: true,
      user_metadata: {
        userid: u.userid,
        name: u.name,
      }
    });

    let authUserId = authRes?.user?.id;
    if (authErr && authErr.status === 422) {
      // already exists -> resolve id via admin listUsers
      const pageSize = 1000;
      let page = 1;
      let found = null;
      while (!found) {
        const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage: pageSize });
        if (listErr) {
          console.error('  ❌ listUsers error:', listErr);
          break;
        }
        found = list.users?.find((usr) => usr.email?.toLowerCase() === email.toLowerCase());
        if (found || (list.users?.length ?? 0) < pageSize) break;
        page += 1;
      }
      if (!found) {
        console.error('  ❌ Could not resolve existing auth user by email');
        continue;
      }
      authUserId = found.id;
      // Optionally sync password to legacy if available
      if (u.password) {
        const { error: updPassErr } = await supabase.auth.admin.updateUserById(authUserId, { password: u.password });
        if (updPassErr) console.warn('  ⚠️  Failed to update password for existing auth user:', updPassErr.message);
      }
    } else if (authErr && authErr.message && !authErr.message.includes('already registered')) {
      console.error('  ❌ createUser error:', authErr);
      continue;
    }

    // 2) Get current profile id so we can update reports fk
    const { data: profile, error: profErr } = await supabase
      .from('users')
      .select('id')
      .eq('userid', u.userid)
      .single();
    if (profErr || !profile) {
      console.error('  ❌ Missing profile row in users for', u.userid, profErr);
      continue;
    }
    const oldProfileId = profile.id;

    // 3) Update users.id to match auth uid
    const { error: updUserErr } = await supabase
      .from('users')
      .update({ id: authUserId })
      .eq('userid', u.userid);
    if (updUserErr) {
      console.error('  ❌ Failed updating users.id:', updUserErr);
      continue;
    }

    // 4) Update reports fk to new user id
    const { error: updReportsErr } = await supabase
      .from('reports')
      .update({ user_id: authUserId })
      .eq('user_id', oldProfileId);
    if (updReportsErr) {
      console.error('  ❌ Failed updating reports.user_id:', updReportsErr);
      continue;
    }

    console.log(`  ✅ Linked auth uid ${authUserId} and updated reports.`);
  }

  console.log('\n🎉 Provisioning complete.');
  await oldPool.end();
}

if (require.main === module) {
  provision().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { provision };


