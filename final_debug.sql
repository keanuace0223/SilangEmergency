-- ===================================================================
-- FINAL DEBUG - Let's find and fix the exact issue
-- ===================================================================

-- 1. Check what's in your users table for admin1
SELECT 
    'USERS TABLE' as source,
    userid,
    id as uuid,
    name,
    barangay,
    barangay_position,
    created_at
FROM users 
WHERE userid = 'admin1';

-- 2. Check if RLS policies are working
-- This query should work if the user exists and RLS is properly configured
SELECT 
    'RLS TEST' as test_type,
    COUNT(*) as user_count
FROM users 
WHERE userid = 'admin1';

-- 3. Check what the sign-in process is looking for
-- Your app maps email to userid, so let's see what should happen
SELECT 
    'EXPECTED MAPPING' as info,
    userid,
    (userid || '@login.local') as expected_auth_email,
    id as profile_uuid
FROM users 
WHERE userid = 'admin1';

-- ===================================================================
-- 4. DEBUG THE AUTH FLOW
-- ===================================================================

-- Let's create a test to see what your getUserByUserid function would find
-- This simulates what happens during sign-in

-- Check if the user exists (this is what db.getUserByUserid does)
SELECT 
    'GETUSERBYUSERID TEST' as test,
    userid,
    id,
    name,
    barangay,
    barangay_position,
    profile_pic
FROM users 
WHERE userid = 'admin1';

-- Check if the user exists by ID (this is what db.getUser does with auth.uid())
-- You'll need to replace 'YOUR_AUTH_UUID' with the actual auth UUID
-- SELECT 
--     'GETUSER BY ID TEST' as test,
--     userid,
--     id,
--     name
-- FROM users 
-- WHERE id = 'YOUR_AUTH_UUID_HERE';

-- ===================================================================
-- 5. POTENTIAL FIXES
-- ===================================================================

-- If the above queries work but sign-in still fails, try these fixes:

-- Fix A: Ensure the users table has the correct structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND column_name IN ('id', 'userid', 'name', 'barangay', 'barangay_position')
ORDER BY ordinal_position;

-- Fix B: Check if there are any RLS issues
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'users';

-- Fix C: Verify the auth.signInWithUseridAlias function works
-- This checks if the email alias approach is working correctly

-- ===================================================================
-- INSTRUCTIONS AFTER RUNNING THIS:
-- ===================================================================

/*
1. Run all the queries above
2. Share the results with me
3. Based on the results, I'll give you the exact fix

ALSO CHECK IN SUPABASE AUTH DASHBOARD:
1. Go to Authentication > Users
2. Look for user with email: admin1@login.local
3. Click on that user
4. Copy the UUID from the user details page
5. Tell me what that UUID is

THEN RUN THIS UPDATE:
UPDATE users SET id = 'PASTE_AUTH_UUID_HERE' WHERE userid = 'admin1';

The issue is likely a UUID mismatch between auth and profile tables.
*/












