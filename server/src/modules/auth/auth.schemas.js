import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(255);
const password = z.string().min(8).max(72);

const baseRegistration = {
  email,
  password,
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(20).optional(),
};

export const registerSchema = z.discriminatedUnion("role", [
  z.object({
    ...baseRegistration,
    role: z.literal("candidate"),
  }),
  z.object({
    ...baseRegistration,
    role: z.literal("employer"),
    organization: z.object({
      name: z.string().trim().min(2).max(160),
      industry: z.string().trim().max(120).optional(),
      website: z.string().trim().url().max(255).optional(),
      email: email.optional(),
      phone: z.string().trim().max(20).optional(),
      description: z.string().trim().max(2000).optional(),
      location: z.string().trim().max(200).optional(),
    }),
  }),
  z.object({
    ...baseRegistration,
    role: z.literal("institute"),
    institution: z.object({
      name: z.string().trim().min(2).max(200),
      code: z.string().trim().min(2).max(40),
      website: z.string().trim().url().max(255).optional(),
      email: email.optional(),
      phone: z.string().trim().max(20).optional(),
      address: z.string().trim().max(500).optional(),
      city: z.string().trim().max(120).optional(),
      state: z.string().trim().max(120).optional(),
      country: z.string().trim().max(120).optional(),
    }),
  }),
]);

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72),
});
