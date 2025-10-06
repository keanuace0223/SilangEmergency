-- ===================================================================
-- SIMPLE FIX FOR ADMIN LOGIN ISSUE
-- Follow these steps exactly
-- ===================================================================

-- STEP 1: Delete and recreate admin1 to start fresh
DELETE FROM users WHERE userid = 'admin1';

-- STEP 2: Create admin1 with a new UUID
INSERT INTO users (userid, name, barangay, barangay_position) 
VALUES ('admin1', 'System Administrator', 'Poblacion I', 'System Admin');

-- STEP 3: Get the new UUID that was generated
SELECT 
    'NEW ADMIN1 UUID' as info,
    userid,
    id as new_uuid,
    'USE THIS UUID FOR AUTH USER' as instruction
FROM users 
WHERE userid = 'admin1';

-- ===================================================================
-- AFTER RUNNING THE ABOVE SQL:
-- ===================================================================

/*
1. Copy the UUID from the query result above
2. Go to Supabase Dashboard → Authentication → Users
3. DELETE any existing admin1@login.local user
4. Click "Add User"
5. Fill in:
   - Email: admin1@login.local
   - Password: admin1_Admin123!
   - Auto Confirm User: ✅ YES
6. Click "Create User"
7. Click on the new user in the list
8. Copy the auth UUID from the user details
9. Run this update query:

UPDATE users 
SET id = 'PASTE_AUTH_UUID_HERE' 
WHERE userid = 'admin1';

10. Test login with:
    - User ID: admin1
    - Password: admin1_Admin123!
*/

-- STEP 4: After updating the UUID, verify everything matches
SELECT 
    'VERIFICATION' as check,
    userid,
    id as final_uuid,
    'This should match your auth user UUID' as note
FROM users 
WHERE userid = 'admin1';












