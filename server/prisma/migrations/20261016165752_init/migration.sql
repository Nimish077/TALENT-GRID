-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "avatar_url" TEXT,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "email_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution_users" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution_imports" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "file_url" TEXT,
    "file_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "successful_rows" INTEGER NOT NULL DEFAULT 0,
    "failed_rows" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "uploaded_by_user_id" UUID NOT NULL,

    CONSTRAINT "institution_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution_memberships" (
    "id" UUID NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "institutional_email" TEXT,
    "personal_email" TEXT,
    "phone" TEXT,
    "department" TEXT,
    "program" TEXT,
    "batch" TEXT,
    "graduation_year" INTEGER,
    "current_semester" INTEGER,
    "cgpa" DECIMAL(4,2),
    "backlog_count" INTEGER,
    "membership_status" TEXT NOT NULL DEFAULT 'active',
    "verification_status" TEXT NOT NULL DEFAULT 'unverified',
    "verification_source" TEXT,
    "joined_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "institution_id" UUID NOT NULL,
    "import_id" UUID,
    "user_id" UUID,

    CONSTRAINT "institution_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution_membership_claims" (
    "id" UUID NOT NULL,
    "institution_membership_id" UUID NOT NULL,
    "requested_email" TEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "otp_expires_at" TIMESTAMP(3) NOT NULL,
    "otp_attempts" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID,

    CONSTRAINT "institution_membership_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "profile_photo_url" TEXT,
    "location" TEXT,
    "github_url" TEXT,
    "linkedin_url" TEXT,
    "portfolio_url" TEXT,
    "resume_url" TEXT,
    "profile_visibility" TEXT NOT NULL DEFAULT 'public',
    "open_to_work" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_educations" (
    "id" UUID NOT NULL,
    "institution_id" UUID,
    "institution_name" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "field_of_study" TEXT,
    "start_year" INTEGER NOT NULL,
    "end_year" INTEGER,
    "verification_status" TEXT NOT NULL DEFAULT 'unverified',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "candidate_profile_id" UUID NOT NULL,

    CONSTRAINT "candidate_educations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_projects" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "project_url" TEXT,
    "github_url" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "candidate_profile_id" UUID NOT NULL,

    CONSTRAINT "candidate_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_experiences" (
    "id" UUID NOT NULL,
    "organization_name" TEXT NOT NULL,
    "job_title" TEXT NOT NULL,
    "description" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "candidate_profile_id" UUID NOT NULL,

    CONSTRAINT "candidate_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_certifications" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "issuing_organization" TEXT,
    "credential_id" TEXT,
    "credential_url" TEXT,
    "issue_date" DATE,
    "expiry_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "candidate_profile_id" UUID NOT NULL,

    CONSTRAINT "candidate_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_skills" (
    "id" UUID NOT NULL,
    "candidate_profile_id" UUID NOT NULL,
    "declared_level" TEXT NOT NULL,
    "verification_status" TEXT NOT NULL DEFAULT 'unverified',
    "verified_level" TEXT,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "skill_id" UUID NOT NULL,

    CONSTRAINT "candidate_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_consents" (
    "id" UUID NOT NULL,
    "candidate_profile_id" UUID NOT NULL,
    "consent_type" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "policy_version" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assessment_type" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'beginner',
    "duration_minutes" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_skills" (
    "id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "target_level" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_attempts" (
    "id" UUID NOT NULL,
    "candidate_profile_id" UUID NOT NULL,
    "placement_drive_candidate_id" UUID,
    "attempt_number" INTEGER NOT NULL,
    "score" DECIMAL(5,2),
    "level" TEXT,
    "result_status" TEXT NOT NULL DEFAULT 'pending',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "evaluated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "job_application_id" UUID,
    "assessment_id" UUID NOT NULL,

    CONSTRAINT "assessment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "description" TEXT,
    "logo_url" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_users" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "work_mode" TEXT,
    "employment_type" TEXT,
    "experience_level" TEXT,
    "salary_min" DECIMAL(12,2),
    "salary_max" DECIMAL(12,2),
    "application_deadline" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "organization_id" UUID NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_skills" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "required_level" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "skill_id" UUID NOT NULL,

    CONSTRAINT "job_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_assessments" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessment_id" UUID NOT NULL,

    CONSTRAINT "job_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" UUID NOT NULL,
    "candidate_profile_id" UUID NOT NULL,
    "invited_by_user_id" UUID,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "resume_url" TEXT,
    "cover_note" TEXT,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "job_id" UUID NOT NULL,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "placement_drives" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "application_open_at" TIMESTAMP(3),
    "application_deadline" TIMESTAMP(3),
    "min_cgpa" DECIMAL(4,2),
    "max_backlogs" INTEGER,
    "eligible_batch" TEXT,
    "eligibility_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "placement_drives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "placement_drive_candidates" (
    "id" UUID NOT NULL,
    "candidate_profile_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "eligibility_status" TEXT NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shortlisted_at" TIMESTAMP(3),
    "selected_at" TIMESTAMP(3),
    "placement_drive_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "placement_drive_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "placement_drive_departments" (
    "id" UUID NOT NULL,
    "placement_drive_id" UUID NOT NULL,
    "department_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "placement_drive_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "placement_drive_jobs" (
    "id" UUID NOT NULL,
    "placement_drive_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "placement_drive_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "placement_drive_assessments" (
    "id" UUID NOT NULL,
    "placement_drive_id" UUID NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessment_id" UUID NOT NULL,

    CONSTRAINT "placement_drive_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoke_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_code_key" ON "institutions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "institution_users_institution_id_user_id_key" ON "institution_users"("institution_id", "user_id");

-- CreateIndex
CREATE INDEX "institution_memberships_institution_id_membership_status_idx" ON "institution_memberships"("institution_id", "membership_status");

-- CreateIndex
CREATE UNIQUE INDEX "institution_memberships_institution_id_enrollment_id_key" ON "institution_memberships"("institution_id", "enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_profiles_user_id_key" ON "candidate_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- CreateIndex
CREATE INDEX "candidate_skills_skill_id_verification_status_verified_leve_idx" ON "candidate_skills"("skill_id", "verification_status", "verified_level");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_skills_candidate_profile_id_skill_id_key" ON "candidate_skills"("candidate_profile_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_consents_candidate_profile_id_consent_type_key" ON "candidate_consents"("candidate_profile_id", "consent_type");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_skills_assessment_id_skill_id_key" ON "assessment_skills"("assessment_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_attempts_assessment_id_candidate_profile_id_atte_key" ON "assessment_attempts"("assessment_id", "candidate_profile_id", "attempt_number");

-- CreateIndex
CREATE UNIQUE INDEX "organization_users_organization_id_user_id_key" ON "organization_users"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "jobs_status_published_at_idx" ON "jobs"("status", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "job_skills_job_id_skill_id_key" ON "job_skills"("job_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_assessments_job_id_assessment_id_key" ON "job_assessments"("job_id", "assessment_id");

-- CreateIndex
CREATE INDEX "job_applications_job_id_status_idx" ON "job_applications"("job_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "job_applications_job_id_candidate_profile_id_key" ON "job_applications"("job_id", "candidate_profile_id");

-- CreateIndex
CREATE INDEX "placement_drive_candidates_placement_drive_id_status_idx" ON "placement_drive_candidates"("placement_drive_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "placement_drive_candidates_placement_drive_id_candidate_pro_key" ON "placement_drive_candidates"("placement_drive_id", "candidate_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "placement_drive_departments_placement_drive_id_department_n_key" ON "placement_drive_departments"("placement_drive_id", "department_name");

-- CreateIndex
CREATE UNIQUE INDEX "placement_drive_jobs_placement_drive_id_job_id_key" ON "placement_drive_jobs"("placement_drive_id", "job_id");

-- CreateIndex
CREATE UNIQUE INDEX "placement_drive_assessments_placement_drive_id_assessment_i_key" ON "placement_drive_assessments"("placement_drive_id", "assessment_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_family_id_idx" ON "sessions"("family_id");

-- AddForeignKey
ALTER TABLE "institution_users" ADD CONSTRAINT "institution_users_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_users" ADD CONSTRAINT "institution_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_imports" ADD CONSTRAINT "institution_imports_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_imports" ADD CONSTRAINT "institution_imports_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_memberships" ADD CONSTRAINT "institution_memberships_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_memberships" ADD CONSTRAINT "institution_memberships_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "institution_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_memberships" ADD CONSTRAINT "institution_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_membership_claims" ADD CONSTRAINT "institution_membership_claims_institution_membership_id_fkey" FOREIGN KEY ("institution_membership_id") REFERENCES "institution_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_membership_claims" ADD CONSTRAINT "institution_membership_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_educations" ADD CONSTRAINT "candidate_educations_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_educations" ADD CONSTRAINT "candidate_educations_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_projects" ADD CONSTRAINT "candidate_projects_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_experiences" ADD CONSTRAINT "candidate_experiences_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_certifications" ADD CONSTRAINT "candidate_certifications_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_consents" ADD CONSTRAINT "candidate_consents_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_skills" ADD CONSTRAINT "assessment_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_skills" ADD CONSTRAINT "assessment_skills_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_placement_drive_candidate_id_fkey" FOREIGN KEY ("placement_drive_candidate_id") REFERENCES "placement_drive_candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_job_application_id_fkey" FOREIGN KEY ("job_application_id") REFERENCES "job_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_assessments" ADD CONSTRAINT "job_assessments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_assessments" ADD CONSTRAINT "job_assessments_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_drives" ADD CONSTRAINT "placement_drives_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_drives" ADD CONSTRAINT "placement_drives_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_drive_candidates" ADD CONSTRAINT "placement_drive_candidates_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_drive_candidates" ADD CONSTRAINT "placement_drive_candidates_placement_drive_id_fkey" FOREIGN KEY ("placement_drive_id") REFERENCES "placement_drives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_drive_departments" ADD CONSTRAINT "placement_drive_departments_placement_drive_id_fkey" FOREIGN KEY ("placement_drive_id") REFERENCES "placement_drives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_drive_jobs" ADD CONSTRAINT "placement_drive_jobs_placement_drive_id_fkey" FOREIGN KEY ("placement_drive_id") REFERENCES "placement_drives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_drive_jobs" ADD CONSTRAINT "placement_drive_jobs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_drive_assessments" ADD CONSTRAINT "placement_drive_assessments_placement_drive_id_fkey" FOREIGN KEY ("placement_drive_id") REFERENCES "placement_drives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_drive_assessments" ADD CONSTRAINT "placement_drive_assessments_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written constraints that Prisma cannot express declaratively.
-- These enforce the inferred vocabularies and business guards documented in
-- README.md ("Inference register"). Allowed values are a smallest-defensible
-- interpretation of the varchar columns in DatabaseSchema.png.
-- ---------------------------------------------------------------------------

-- Identity & access
ALTER TABLE "users" ADD CONSTRAINT "users_role_check"
  CHECK ("role" IN ('candidate', 'employer', 'institute', 'admin'));
ALTER TABLE "users" ADD CONSTRAINT "users_status_check"
  CHECK ("status" IN ('active', 'suspended'));

-- Candidate profiles, skills, consents
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_visibility_check"
  CHECK ("profile_visibility" IN ('public', 'employers_only', 'private'));
ALTER TABLE "candidate_educations" ADD CONSTRAINT "candidate_educations_verification_check"
  CHECK ("verification_status" IN ('unverified', 'pending', 'verified', 'rejected'));
ALTER TABLE "skills" ADD CONSTRAINT "skills_status_check"
  CHECK ("status" IN ('active', 'archived'));
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_declared_level_check"
  CHECK ("declared_level" IN ('beginner', 'intermediate', 'advanced'));
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_verified_level_check"
  CHECK ("verified_level" IS NULL OR "verified_level" IN ('beginner', 'intermediate', 'advanced'));
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_verification_check"
  CHECK ("verification_status" IN ('unverified', 'pending', 'verified', 'rejected'));

-- Assessments
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_type_check"
  CHECK ("assessment_type" IN ('skill', 'coding', 'aptitude', 'custom'));
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_difficulty_check"
  CHECK ("difficulty" IN ('beginner', 'intermediate', 'advanced'));
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_status_check"
  CHECK ("status" IN ('draft', 'active', 'archived'));
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_duration_check"
  CHECK ("duration_minutes" > 0);
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_version_check"
  CHECK ("version" >= 1);
ALTER TABLE "assessment_skills" ADD CONSTRAINT "assessment_skills_target_level_check"
  CHECK ("target_level" IN ('beginner', 'intermediate', 'advanced'));
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_status_check"
  CHECK ("result_status" IN ('pending', 'passed', 'failed', 'abandoned'));
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_level_check"
  CHECK ("level" IS NULL OR "level" IN ('beginner', 'intermediate', 'advanced'));
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_score_check"
  CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 100));
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_number_check"
  CHECK ("attempt_number" >= 1);
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_context_check"
  CHECK ("job_application_id" IS NULL OR "placement_drive_candidate_id" IS NULL);

-- Organizations & jobs
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_status_check"
  CHECK ("status" IN ('pending', 'active', 'suspended'));
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_role_check"
  CHECK ("role" IN ('owner', 'admin', 'member'));
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_status_check"
  CHECK ("status" IN ('pending', 'active', 'suspended'));
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_status_check"
  CHECK ("status" IN ('draft', 'published', 'closed', 'archived'));
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_salary_check"
  CHECK ("salary_min" IS NULL OR "salary_max" IS NULL OR "salary_min" <= "salary_max");
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_source_check"
  CHECK ("source" IN ('self_applied', 'invited', 'placement_drive'));
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_status_check"
  CHECK ("status" IN ('applied', 'shortlisted', 'selected', 'rejected', 'withdrawn'));

-- Institutions, memberships, claims
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_status_check"
  CHECK ("status" IN ('pending', 'active', 'suspended'));
ALTER TABLE "institution_users" ADD CONSTRAINT "institution_users_role_check"
  CHECK ("role" IN ('owner', 'admin', 'member'));
ALTER TABLE "institution_users" ADD CONSTRAINT "institution_users_status_check"
  CHECK ("status" IN ('pending', 'active', 'suspended'));
ALTER TABLE "institution_imports" ADD CONSTRAINT "institution_imports_status_check"
  CHECK ("status" IN ('processing', 'completed', 'partial', 'failed'));
ALTER TABLE "institution_imports" ADD CONSTRAINT "institution_imports_counts_check"
  CHECK ("total_rows" >= 0 AND "successful_rows" >= 0 AND "failed_rows" >= 0);
ALTER TABLE "institution_memberships" ADD CONSTRAINT "institution_memberships_status_check"
  CHECK ("membership_status" IN ('active', 'inactive', 'graduated'));
ALTER TABLE "institution_memberships" ADD CONSTRAINT "institution_memberships_verification_check"
  CHECK ("verification_status" IN ('unverified', 'pending', 'verified', 'rejected'));
ALTER TABLE "institution_memberships" ADD CONSTRAINT "institution_memberships_source_check"
  CHECK ("verification_source" IS NULL OR "verification_source" IN ('institution_import', 'institute', 'email_otp'));
ALTER TABLE "institution_memberships" ADD CONSTRAINT "institution_memberships_cgpa_check"
  CHECK ("cgpa" IS NULL OR ("cgpa" >= 0 AND "cgpa" <= 10));
ALTER TABLE "institution_memberships" ADD CONSTRAINT "institution_memberships_backlog_check"
  CHECK ("backlog_count" IS NULL OR "backlog_count" >= 0);
ALTER TABLE "institution_membership_claims" ADD CONSTRAINT "institution_membership_claims_status_check"
  CHECK ("status" IN ('pending', 'verified', 'expired', 'locked'));
ALTER TABLE "institution_membership_claims" ADD CONSTRAINT "institution_membership_claims_attempts_check"
  CHECK ("otp_attempts" >= 0);

-- Placement drives
ALTER TABLE "placement_drives" ADD CONSTRAINT "placement_drives_status_check"
  CHECK ("status" IN ('draft', 'open', 'closed', 'completed', 'cancelled'));
ALTER TABLE "placement_drives" ADD CONSTRAINT "placement_drives_cgpa_check"
  CHECK ("min_cgpa" IS NULL OR ("min_cgpa" >= 0 AND "min_cgpa" <= 10));
ALTER TABLE "placement_drives" ADD CONSTRAINT "placement_drives_backlog_check"
  CHECK ("max_backlogs" IS NULL OR "max_backlogs" >= 0);
ALTER TABLE "placement_drive_candidates" ADD CONSTRAINT "placement_drive_candidates_status_check"
  CHECK ("status" IN ('applied', 'shortlisted', 'selected', 'rejected', 'withdrawn'));
ALTER TABLE "placement_drive_candidates" ADD CONSTRAINT "placement_drive_candidates_eligibility_check"
  CHECK ("eligibility_status" IN ('eligible', 'not_eligible'));

-- Sessions (authorized extension)
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_revoke_reason_check"
  CHECK ("revoke_reason" IS NULL OR "revoke_reason" IN ('rotated', 'logout', 'reuse_detected', 'admin'));
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_expiry_check"
  CHECK ("expires_at" > "created_at");

-- Partial unique indexes enforcing workflow invariants:
--   * at most one open (pending) attempt per candidate and assessment
--   * at most one pending membership claim per membership
CREATE UNIQUE INDEX "assessment_attempts_one_open_idx"
  ON "assessment_attempts" ("assessment_id", "candidate_profile_id")
  WHERE "result_status" = 'pending';
CREATE UNIQUE INDEX "institution_membership_claims_one_pending_idx"
  ON "institution_membership_claims" ("institution_membership_id")
  WHERE "status" = 'pending';
