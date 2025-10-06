-- ===================================================================
-- VERIFY ADMIN SETUP ISSUE
-- Run this to see what's currently wrong
-- ===================================================================

-- Check if admin users exist in the users table
SELECT 
    'Users Table Check' as check_type,
    COUNT(*) as admin_users_count,
    string_agg(userid, ', ') as found_userids
FROM users 
WHERE userid IN ('admin1', 'admin2', 'admin3');

-- Check the specific UUIDs and details
SELECT 
    'User Details' as info,
    userid,
    id as current_uuid,
    name,
    LENGTH(id::text) as uuid_length,
    CASE 
        WHEN id IS NULL THEN 'UUID is NULL - PROBLEM!'
        WHEN LENGTH(id::text) != 36 THEN 'UUID format issue - PROBLEM!'
        ELSE 'UUID looks OK'
    END as uuid_status
FROM users 
WHERE userid IN ('admin1', 'admin2', 'admin3')
ORDER BY userid;

-- Check if there are any duplicate userids (shouldn't happen but let's check)
SELECT 
    userid,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) > 1 THEN 'DUPLICATE - PROBLEM!'
        ELSE 'OK'
    END as status
FROM users 
WHERE userid IN ('admin1', 'admin2', 'admin3')
GROUP BY userid;

-- Show what the auth email should be for each user
SELECT 
    'Expected Auth Details' as info,
    userid,
    (userid || '@login.local') as expected_auth_email,
    (userid || '_Admin123!') as expected_password,
    id as current_profile_uuid
FROM users 
WHERE userid IN ('admin1', 'admin2', 'admin3')
ORDER BY userid;
