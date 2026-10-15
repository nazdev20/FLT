-- Registration applications are stored separately from Supabase Auth.
-- Passwords are intentionally never persisted in this table.
CREATE TABLE IF NOT EXISTS "FLT".registration_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  email text NOT NULL,
  image_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registration_applications_email_unique UNIQUE (email)
);

ALTER TABLE "FLT".registration_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS flt_registration_admin_select ON "FLT".registration_applications;
CREATE POLICY flt_registration_admin_select ON "FLT".registration_applications
  FOR SELECT TO authenticated USING ("FLT".is_admin());
DROP POLICY IF EXISTS flt_registration_admin_update ON "FLT".registration_applications;
CREATE POLICY flt_registration_admin_update ON "FLT".registration_applications
  FOR UPDATE TO authenticated USING ("FLT".is_admin()) WITH CHECK ("FLT".is_admin());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('registration-proofs', 'registration-proofs', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS flt_registration_proofs_admin_read ON storage.objects;
CREATE POLICY flt_registration_proofs_admin_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'registration-proofs' AND "FLT".is_admin());