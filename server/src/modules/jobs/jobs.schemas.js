import { z } from "zod";

const levelEnum = z.enum(["beginner", "intermediate", "advanced"]);
const uuid = z.string().uuid();
const url = z.string().trim().url().max(500);

export const jobCreateSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(20000).nullish(),
    location: z.string().trim().max(200).nullish(),
    work_mode: z.enum(["onsite", "hybrid", "remote"]).nullish(),
    employment_type: z
      .enum(["full_time", "part_time", "internship", "contract"])
      .nullish(),
    experience_level: z.string().trim().max(80).nullish(),
    salary_min: z.number().min(0).nullish(),
    salary_max: z.number().min(0).nullish(),
    application_deadline: z.coerce.date().nullish(),
  })
  .refine(
    (value) =>
      value.salary_min === null ||
      value.salary_min === undefined ||
      value.salary_max === null ||
      value.salary_max === undefined ||
      value.salary_min <= value.salary_max,
    {
      message: "salary_min must be less than or equal to salary_max",
      path: ["salary_min"],
    }
  );

export const jobUpdateSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(20000).nullish(),
    location: z.string().trim().max(200).nullish(),
    work_mode: z.enum(["onsite", "hybrid", "remote"]).nullish(),
    employment_type: z
      .enum(["full_time", "part_time", "internship", "contract"])
      .nullish(),
    experience_level: z.string().trim().max(80).nullish(),
    salary_min: z.number().min(0).nullish(),
    salary_max: z.number().min(0).nullish(),
    application_deadline: z.coerce.date().nullish(),
  })
  .refine(
    (value) =>
      value.salary_min === null ||
      value.salary_min === undefined ||
      value.salary_max === null ||
      value.salary_max === undefined ||
      value.salary_min <= value.salary_max,
    {
      message: "salary_min must be less than or equal to salary_max",
      path: ["salary_min"],
    }
  );

export const jobSkillsPutSchema = z.object({
  skills: z
    .array(
      z.object({
        skill_id: uuid,
        required_level: levelEnum,
        is_required: z.boolean().default(true),
      })
    )
    .max(50),
});

export const jobAssessmentsPutSchema = z.object({
  assessments: z
    .array(
      z.object({
        assessment_id: uuid,
        is_required: z.boolean().default(false),
      })
    )
    .max(20),
});

export const jobListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const applicationCreateSchema = z.object({
  resume_url: url.nullish(),
  cover_note: z.string().trim().max(5000).nullish(),
});

export const applicationStatusSchema = z.object({
  status: z.enum(["shortlisted", "selected", "rejected"]),
});

export const invitationCreateSchema = z.object({
  candidate_profile_id: uuid,
});
