-- Migration Script for AVPU Patient Status and Report Limit Features
-- Run this in your Supabase SQL Editor

-- ============================================
-- Feature 1: Change Urgency to Patient Status (AVPU)
-- ============================================

-- Step 1: Add new columns for patient_status and urgency_level
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS patient_status TEXT,
ADD COLUMN IF NOT EXISTS urgency_level TEXT;

-- Step 2: Migrate existing urgency_tag data to patient_status
-- Map old urgency to AVPU scale (conservative mapping):
-- Low -> Alert, Moderate -> Voice, High -> Pain
UPDATE reports
SET 
  patient_status = CASE 
    WHEN urgency_tag = 'Low' THEN 'Alert'
    WHEN urgency_tag = 'Moderate' THEN 'Voice'
    WHEN urgency_tag = 'High' THEN 'Pain'
    ELSE 'Alert'
  END,
  urgency_level = urgency_tag
WHERE patient_status IS NULL;

-- Step 3: Set urgency_level based on patient_status for all records
UPDATE reports
SET urgency_level = CASE
  WHEN patient_status = 'Alert' THEN 'Low'
  WHEN patient_status = 'Voice' THEN 'Moderate'
  WHEN patient_status = 'Pain' THEN 'High'
  WHEN patient_status = 'Unresponsive' THEN 'High'
  ELSE 'Low'
END
WHERE urgency_level IS NULL;

-- Step 4: Drop old urgency_tag constraint and rename column
ALTER TABLE reports
DROP CONSTRAINT IF EXISTS reports_urgency_tag_check;

-- Step 5: Add new CHECK constraints
ALTER TABLE reports
ADD CONSTRAINT reports_patient_status_check 
  CHECK (patient_status IN ('Alert', 'Voice', 'Pain', 'Unresponsive')),
ADD CONSTRAINT reports_urgency_level_check 
  CHECK (urgency_level IN ('Low', 'Moderate', 'High'));

-- Step 6: Make columns NOT NULL (after migration)
ALTER TABLE reports
ALTER COLUMN patient_status SET NOT NULL,
ALTER COLUMN urgency_level SET NOT NULL;

-- ============================================
-- Feature 2: Report Limit Feature (3 per Hour)
-- ============================================

-- Step 1: Add report_type column
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS report_type TEXT CHECK (report_type IN ('official', 'follow-up'))
DEFAULT 'official';

-- Step 2: Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_reports_user_created_at 
ON reports(user_id, created_at DESC);

-- Step 3: Create function to check report count in last hour
CREATE OR REPLACE FUNCTION check_reports_last_hour(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  report_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO report_count
  FROM reports
  WHERE user_id = p_user_id
    AND created_at >= NOW() - INTERVAL '1 hour';
  
  RETURN report_count;
END;
$$;

-- Step 4: Create function to get report limit status
CREATE OR REPLACE FUNCTION get_report_limit_status(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  report_count INTEGER;
  remaining_count INTEGER;
  limit_reached BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO report_count
  FROM reports
  WHERE user_id = p_user_id
    AND created_at >= NOW() - INTERVAL '1 hour';
  
  remaining_count := GREATEST(0, 3 - report_count);
  limit_reached := report_count >= 3;
  
  RETURN json_build_object(
    'count', report_count,
    'remaining', remaining_count,
    'limitReached', limit_reached,
    'limit', 3
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_reports_last_hour(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_report_limit_status(UUID) TO authenticated;

-- Note: Keep urgency_tag column for backward compatibility during transition
-- You can drop it later if needed: ALTER TABLE reports DROP COLUMN urgency_tag;

