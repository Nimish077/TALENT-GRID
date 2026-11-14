import { z } from "zod";

const uuid = z.string().uuid();
const department = z.string().trim().min(1).max(120);

export const driveCreateSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(20000).nullish(),
  application_open_at: z.coerce.date().nullish(),
  application_deadline: z.coerce.date().nullish(),
  min_cgpa: z.number().min(0).max(10).nullish(),
  max_backlogs: z.number().int().min(0).max(50).nullish(),
  eligible_batch: z.string().trim().max(40).nullish(),
  eligibility_notes: z.string().trim().max(5000).nullish(),
  departments: z.array(department).max(50).optional(),
});

export const driveUpdateSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(20000).nullish(),
  application_open_at: z.coerce.date().nullish(),
  application_deadline: z.coerce.date().nullish(),
  min_cgpa: z.number().min(0).max(10).nullish(),
  max_backlogs: z.number().int().min(0).max(50).nullish(),
  eligible_batch: z.string().trim().max(40).nullish(),
  eligibility_notes: z.string().trim().max(5000).nullish(),
});

export const departmentsPutSchema = z.object({
  departments: z
    .array(department)
    .max(50)
    .refine(
      (items) =>
        new Set(items.map((d) => d.toLowerCase())).size === items.length,
      {
        message: "Duplicate department names are not allowed",
      }
    ),
});

export const driveJobsPutSchema = z.object({
  job_ids: z
    .array(uuid)
    .max(50)
    .refine((items) => new Set(items).size === items.length, {
      message: "Duplicate job ids are not allowed",
    }),
});

export const driveAssessmentsPutSchema = z.object({
  assessments: z
    .array(
      z.object({
        assessment_id: uuid,
        is_required: z.boolean().default(false),
      })
    )
    .max(20)
    .refine(
      (items) =>
        new Set(items.map((a) => a.assessment_id)).size === items.length,
      { message: "Duplicate assessment ids are not allowed" }
    ),
});

export const driveCandidateStatusSchema = z.object({
  status: z.enum(["shortlisted", "selected", "rejected"]),
});
