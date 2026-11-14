import { z } from "zod";

const url = z.string().trim().url().max(500);
const email = z.string().trim().toLowerCase().email().max(255);

export const institutionCreateSchema = z.object({
  name: z.string().trim().min(2).max(200),
  code: z.string().trim().min(2).max(40),
  website: url.nullish(),
  email: email.nullish(),
  phone: z.string().trim().max(20).nullish(),
  address: z.string().trim().max(500).nullish(),
  city: z.string().trim().max(120).nullish(),
  state: z.string().trim().max(120).nullish(),
  country: z.string().trim().max(120).nullish(),
});

export const institutionUpdateSchema = institutionCreateSchema.partial();

export const membershipCreateSchema = z.object({
  enrollment_id: z.string().trim().min(1).max(80),
  full_name: z.string().trim().min(2).max(160),
  institutional_email: email.nullish(),
  personal_email: email.nullish(),
  phone: z.string().trim().max(20).nullish(),
  department: z.string().trim().max(120).nullish(),
  program: z.string().trim().max(120).nullish(),
  batch: z.string().trim().max(40).nullish(),
  graduation_year: z.number().int().min(1950).max(2100).nullish(),
  current_semester: z.number().int().min(1).max(20).nullish(),
  cgpa: z.number().min(0).max(10).nullish(),
  backlog_count: z.number().int().min(0).max(50).nullish(),
});

export const membershipUpdateSchema = membershipCreateSchema
  .omit({ enrollment_id: true })
  .partial()
  .extend({
    membership_status: z.enum(["active", "inactive", "graduated"]).optional(),
  });

export const membershipListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  membership_status: z.enum(["active", "inactive", "graduated"]).optional(),
  verification_status: z
    .enum(["unverified", "pending", "verified", "rejected"])
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const importCreateSchema = z.object({
  file_name: z.string().trim().max(255).nullish(),
  file_url: url.nullish(),
  rows: z.array(membershipCreateSchema).min(1).max(500),
});

export const claimCreateSchema = z.object({
  institution_id: z.string().uuid(),
  enrollment_id: z.string().trim().min(1).max(80),
  requested_email: email,
});

export const claimVerifySchema = z.object({
  otp: z.string().regex(/^\d{6}$/, "OTP must be a 6-digit code"),
});

export const institutionMemberAddSchema = z.object({
  email,
  role: z.enum(["owner", "admin", "member"]).default("member"),
});

export const institutionMemberUpdateSchema = z
  .object({
    role: z.enum(["owner", "admin", "member"]).optional(),
    status: z.enum(["pending", "active", "suspended"]).optional(),
  })
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: "Provide at least one of role or status",
  });
