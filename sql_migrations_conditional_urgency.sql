-- Migration: Allow patient_status to accept both AVPU values and Urgency values (Low/Moderate/High)
-- This enables conditional urgency based on incident type
-- Run this in your Supabase SQL Editor

-- Step 1: Remove the CHECK constraint from patient_status column
-- This allows the column to accept both AVPU values (Alert, Voice, Pain, Unresponsive) 
-- and Urgency values (Low, Moderate, High) based on incident type

ALTER TABLE reports
DROP CONSTRAINT IF EXISTS reports_patient_status_check;

-- Step 2: Add a new CHECK constraint that allows both sets of values
-- This ensures data integrity while allowing flexibility

ALTER TABLE reports
ADD CONSTRAINT reports_patient_status_check 
CHECK (
  patient_status IN (
    'Alert', 'Voice', 'Pain', 'Unresponsive',  -- AVPU values for Vehicular Accident
    'Low', 'Moderate', 'High'                   -- Urgency values for other incident types
  ) OR patient_status IS NULL
);

-- Note: The urgency_level column already exists and should be used for the actual urgency level
-- The patient_status column now stores either:
-- - AVPU status (for Vehicular Accident incidents)
-- - Urgency level (for Fire, Flood, Earthquake, Electrical, Others incidents)
--
-- The backend API should map these correctly:
-- - For Vehicular Accident: patient_status = AVPU value, urgency_level = mapped from AVPU
-- - For other types: patient_status = urgency value, urgency_level = same urgency value

