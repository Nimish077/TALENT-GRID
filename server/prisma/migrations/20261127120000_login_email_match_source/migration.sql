-- Shadow profiles can now be claimed by signing in with the listed email.
ALTER TABLE "institution_memberships" DROP CONSTRAINT "institution_memberships_source_check";
ALTER TABLE "institution_memberships" ADD CONSTRAINT "institution_memberships_source_check"
  CHECK ("verification_source" IS NULL OR "verification_source" IN ('institution_import', 'institute', 'email_otp', 'login_email_match'));
