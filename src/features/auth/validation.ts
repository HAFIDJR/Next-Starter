import { z } from "zod";

export const emailSchema = z
  .string("Email address is required.")
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(254, "Email address must be 254 characters or fewer.");

export const passwordSchema = z
  .string("Password is required.")
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be 128 characters or fewer.")
  .regex(/[a-z]/i, "Password must include at least one letter.")
  .regex(/\d/, "Password must include at least one number.");

export const credentialsSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export type CredentialsInput = z.infer<typeof credentialsSchema>;