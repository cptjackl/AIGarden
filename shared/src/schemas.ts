import { z } from "zod";

export const EmailSchema = z.string().trim().toLowerCase().email().max(254);

export const RegisterInputSchema = z.object({
  email: EmailSchema,
  displayName: z.string().trim().min(1).max(80),
  password: z.string().min(8).max(200),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  createdAt: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const CreateWorldInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(5000).default(""),
});
export type CreateWorldInput = z.input<typeof CreateWorldInputSchema>;

export const UpdateWorldInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(5000),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });
export type UpdateWorldInput = z.infer<typeof UpdateWorldInputSchema>;

export const WorldSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  ownerId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type World = z.infer<typeof WorldSchema>;

export const ApiErrorSchema = z.object({
  error: z.string(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
