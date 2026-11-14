import { z } from "zod";

const url = z.string().trim().url().max(500);
const email = z.string().trim().toLowerCase().email().max(255);

export const organizationCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  industry: z.string().trim().max(120).nullish(),
  website: url.nullish(),
  email: email.nullish(),
  phone: z.string().trim().max(20).nullish(),
  description: z.string().trim().max(2000).nullish(),
  location: z.string().trim().max(200).nullish(),
});

export const organizationUpdateSchema = organizationCreateSchema
  .partial()
  .extend({
    logo_url: url.nullish(),
  });

export const memberAddSchema = z.object({
  email,
  role: z.enum(["owner", "admin", "member"]).default("member"),
});

export const memberUpdateSchema = z
  .object({
    role: z.enum(["owner", "admin", "member"]).optional(),
    status: z.enum(["pending", "active", "suspended"]).optional(),
  })
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: "Provide at least one of role or status",
  });
