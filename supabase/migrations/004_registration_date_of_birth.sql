-- Add date of birth to pending FLT registration applications.
-- The password is intentionally not a column in this table.
ALTER TABLE "FLT".registration_applications
  ADD COLUMN IF NOT EXISTS date_of_birth date;

-- New submissions must include a valid DOB; existing rows can be backfilled by an admin if needed.
ALTER TABLE "FLT".registration_applications
  DROP CONSTRAINT IF EXISTS registration_applications_minimum_age;

ALTER TABLE "FLT".registration_applications
  ADD CONSTRAINT registration_applications_minimum_age
  CHECK (date_of_birth IS NULL OR date_of_birth <= (CURRENT_DATE - INTERVAL '18 years')::date);
