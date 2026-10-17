-- Add date of birth to pending FLT registration applications.
-- Passwords are intentionally never stored in this table.
ALTER TABLE "FLT".registration_applications
  ADD COLUMN IF NOT EXISTS date_of_birth date;

-- Enforce DOB and minimum age for anonymous application submissions.
DROP POLICY IF EXISTS flt_registration_public_insert ON "FLT".registration_applications;
CREATE POLICY flt_registration_public_insert ON "FLT".registration_applications
  FOR INSERT TO anon WITH CHECK (
    status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND rejection_reason IS NULL
    AND date_of_birth IS NOT NULL
    AND date_of_birth <= (CURRENT_DATE - INTERVAL '18 years')::date
  );
