import { z } from "zod";

const levelEnum = z.enum(["beginner", "intermediate", "advanced"]);
const uuid = z.string().uuid();

export const assessmentCreateSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(20000).nullish(),
  assessment_type: z.enum(["skill", "coding", "aptitude", "custom"]),
  difficulty: z
    .enum(["beginner", "intermediate", "advanced"])
    .default("beginner"),
  duration_minutes: z.number().int().min(1).max(600),
  skills: z
    .array(
      z.object({
        skill_id: uuid,
        target_level: levelEnum,
      })
    )
    .min(1)
    .max(30),
});

export const assessmentUpdateSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(20000).nullish(),
  assessment_type: z.enum(["skill", "coding", "aptitude", "custom"]).optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  duration_minutes: z.number().int().min(1).max(600).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  skills: z
    .array(
      z.object({
        skill_id: uuid,
        target_level: levelEnum,
      })
    )
    .min(1)
    .max(30)
    .optional(),
});

export const assessmentListQuerySchema = z.object({
  status: z.enum(["draft", "active", "archived"]).optional(),
  assessment_type: z.enum(["skill", "coding", "aptitude", "custom"]).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const attemptCreateSchema = z
  .object({
    job_application_id: uuid.optional(),
    placement_drive_candidate_id: uuid.optional(),
  })
  .refine(
    (value) =>
      !(value.job_application_id && value.placement_drive_candidate_id),
    {
      message:
        "An attempt cannot be linked to a job application and a drive candidate at the same time",
    }
  );

export const attemptEvaluateSchema = z.object({
  score: z.number().min(0).max(100),
});
