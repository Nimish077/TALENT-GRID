import { z } from "zod";

const url = z.string().trim().url().max(500);
const optionalUrl = url.nullish();
const dateish = z.coerce.date();

const levelEnum = z.enum(["beginner", "intermediate", "advanced"]);
const uuid = z.string().uuid();

export const profileUpdateSchema = z.object({
  headline: z.string().trim().max(160).nullish(),
  bio: z.string().trim().max(5000).nullish(),
  profile_photo_url: optionalUrl,
  location: z.string().trim().max(160).nullish(),
  github_url: optionalUrl,
  linkedin_url: optionalUrl,
  portfolio_url: optionalUrl,
  resume_url: optionalUrl,
  profile_visibility: z
    .enum(["public", "employers_only", "private"])
    .optional(),
  open_to_work: z.boolean().optional(),
});

export const educationCreateSchema = z.object({
  institution_id: uuid.nullish(),
  institution_name: z.string().trim().min(2).max(200),
  degree: z.string().trim().min(1).max(160),
  field_of_study: z.string().trim().max(160).nullish(),
  start_year: z.number().int().min(1950).max(2100),
  end_year: z.number().int().min(1950).max(2100).nullish(),
});

export const educationUpdateSchema = educationCreateSchema.partial();

export const experienceCreateSchema = z.object({
  organization_name: z.string().trim().min(2).max(200),
  job_title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).nullish(),
  start_date: dateish.nullish(),
  end_date: dateish.nullish(),
  is_current: z.boolean().optional(),
});

export const experienceUpdateSchema = experienceCreateSchema.partial();

export const projectCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullish(),
  project_url: optionalUrl,
  github_url: optionalUrl,
  start_date: dateish.nullish(),
  end_date: dateish.nullish(),
});

export const projectUpdateSchema = projectCreateSchema.partial();

export const certificationCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  issuing_organization: z.string().trim().max(200).nullish(),
  credential_id: z.string().trim().max(160).nullish(),
  credential_url: optionalUrl,
  issue_date: dateish.nullish(),
  expiry_date: dateish.nullish(),
});

export const certificationUpdateSchema = certificationCreateSchema.partial();

export const candidateSkillCreateSchema = z
  .object({
    skill_id: uuid.optional(),
    skill_name: z.string().trim().min(1).max(120).optional(),
    declared_level: levelEnum,
  })
  .refine((value) => Boolean(value.skill_id) !== Boolean(value.skill_name), {
    message: "Provide exactly one of skill_id or skill_name",
  });

export const candidateSkillUpdateSchema = z.object({
  declared_level: levelEnum,
});

export const consentPutSchema = z.object({
  granted: z.boolean(),
  policy_version: z.string().trim().min(1).max(40).default("v1"),
});

export const idParam = (name) => z.object({ [name]: uuid });
