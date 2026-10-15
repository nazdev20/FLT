-- Allow anonymous users to submit pending applications and upload proof images.
-- Reads and review updates remain admin-only through existing RLS policies.
DROP POLICY IF EXISTS flt_registration_public_insert ON "FLT".registration_applications;
CREATE POLICY flt_registration_public_insert ON "FLT".registration_applications
  FOR INSERT TO anon WITH CHECK (
    status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND rejection_reason IS NULL
  );

DROP POLICY IF EXISTS flt_registration_proofs_public_insert ON storage.objects;
CREATE POLICY flt_registration_proofs_public_insert ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'registration-proofs');
