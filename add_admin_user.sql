-- ===================================================================
-- ADD NEW ADMIN USER SCRIPT
-- Use this template to add more admin users
-- ===================================================================

-- EXAMPLE: Adding admin4, admin5, etc.
-- Replace 'admin4' with your desired admin userid

-- STEP 1: Create the user profile in database
INSERT INTO users (userid, name, barangay, barangay_position) 
VALUES ('admin4', 'Regional Administrator', 'Poblacion I', 'Regional Admin');

-- STEP 2: Get the UUID for the new admin user
SELECT 
    'NEW ADMIN USER CREATED' as status,
    userid,
    id as uuid_for_auth,
    (userid || '@login.local') as auth_email,
    (userid || '_Admin123!') as auth_password,
    'Copy this UUID and use it when creating the auth user' as instruction
FROM users 
WHERE userid = 'admin4';

-- ===================================================================
-- AFTER RUNNING THE SQL ABOVE:
-- ===================================================================

/*
MANUAL STEPS IN SUPABASE DASHBOARD:

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User"
3. Fill in:
   - Email: admin4@login.local
   - Password: admin4_Admin123!
   - Auto Confirm User: ✅ YES
4. Click "Create User"
5. Click on the new user in the list
6. Copy the auth UUID from user details
7. Run this update query:

UPDATE users 
SET id = 'PASTE_AUTH_UUID_HERE' 
WHERE userid = 'admin4';

8. Verify with:
SELECT userid, id, name FROM users WHERE userid = 'admin4';

9. Test login with admin4 / admin4_Admin123!
*/

-- STEP 3: Verification query (run after completing manual steps)
SELECT 
    'VERIFICATION' as check,
    userid,
    id as final_uuid,
    name,
    'Ready for login' as status
FROM users 
WHERE userid = 'admin4';

-- ===================================================================
-- TEMPLATE FOR MULTIPLE ADMINS
-- ===================================================================

-- Uncomment and modify as needed for admin5, admin6, etc.

/*
-- Admin 5
INSERT INTO users (userid, name, barangay, barangay_position) 
VALUES ('admin5', 'Support Manager', 'Poblacion II', 'Support Manager');

-- Admin 6  
INSERT INTO users (userid, name, barangay, barangay_position) 
VALUES ('admin6', 'Data Administrator', 'Poblacion III', 'Data Admin');

-- Get UUIDs for batch creation
SELECT 
    userid,
    id as uuid_for_auth,
    (userid || '@login.local') as auth_email,
    (userid || '_Admin123!') as auth_password
FROM users 
WHERE userid IN ('admin5', 'admin6')
ORDER BY userid;
*/












