-- ===================================================================
-- DEBUG ADMIN USER SETUP
-- Run these queries to identify and fix the profile loading issue
-- ===================================================================

-- 1. Check what admin users exist in the users table
SELECT 
    userid,
    name,
    id as profile_uuid,
    barangay,
    barangay_position,
    created_at
FROM users 
WHERE userid IN ('admin1', 'admin2', 'admin3')
ORDER BY userid;

-- 2. Check if there are any auth users with @login.local emails
-- (This query might not work directly, but shows what we're looking for)
-- You'll need to check this in Supabase Dashboard → Authentication → Users

-- 3. Clean up and recreate admin users with a better approach
-- First, let's delete any existing admin users to start fresh
DELETE FROM users WHERE userid IN ('admin1', 'admin2', 'admin3');

-- 4. Create the admin users with new UUIDs
INSERT INTO users (userid, name, barangay, barangay_position) VALUES
('admin1', 'System Administrator', 'Poblacion I', 'System Admin'),
('admin2', 'User Manager', 'Poblacion II', 'User Manager'),
('admin3', 'Support Administrator', 'Poblacion III', 'Support Admin');

-- 5. Get the new UUIDs that were auto-generated
SELECT 
    userid,
    name,
    id as new_profile_uuid,
    (userid || '@login.local') as auth_email,
    (userid || '_Admin123!') as auth_password
FROM users 
WHERE userid IN ('admin1', 'admin2', 'admin3')
ORDER BY userid;

-- ===================================================================
-- NEXT STEPS AFTER RUNNING THIS:
-- ===================================================================

/*
1. Run this SQL script first

2. Note down the UUIDs from step 5 above

3. Go to Supabase Dashboard → Authentication → Users

4. DELETE any existing admin users with @login.local emails

5. For EACH admin user, create a new auth user:
   - Click "Add User"
   - Email: {userid}@login.local (e.g., admin1@login.local)
   - Password: {userid}_Admin123! (e.g., admin1_Admin123!)
   - Auto Confirm User: ✅ YES
   - Click "Create User"

6. IMMEDIATELY after creating each auth user:
   - Click on the user in the list
   - Copy the UUID from the user details
   - Run this UPDATE query:

   UPDATE users 
   SET id = 'PASTE_AUTH_UUID_HERE' 
   WHERE userid = 'admin1';

   (Replace 'admin1' with admin2, admin3 for the other users)

7. Verify the setup with this query:
*/

SELECT 
    u.userid,
    u.name,
    u.id as final_uuid,
    'This UUID should match the auth user UUID' as verification_note
FROM users u 
WHERE u.userid IN ('admin1', 'admin2', 'admin3')
ORDER BY u.userid;

-- 8. Test sign-in with admin1 / admin1_Admin123!
